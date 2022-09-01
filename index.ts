import "dotenv/config";

import { TodoistApi } from "@doist/todoist-api-typescript";
import { Client } from "@notionhq/client";

const TODOIST_TOKEN = process.env.TODOIST_TOKEN || "";
const todoist = new TodoistApi(TODOIST_TOKEN);
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});
const database_id = process.env.NOTION_DATABASE || "";

async function syncTasks() {
  const todoistTasks = await todoist.getTasks();
  const todoistTaskIds = todoistTasks.map((task) => task.id);
  const todoistProjects = await todoist.getProjects();
  const todoistSections = await todoist.getSections();

  const notionTasks = await notion.databases.query({ database_id });
  const alreadyLoadedTasks = notionTasks.results.map(
    (task) => task.properties.Todoist.number
  );
  const notionUncompletedTasks = await notion.databases.query({
    database_id,
    filter: {
      and: [
        {
          property: "Status",
          select: {
            does_not_equal: "Submitted",
          },
        },
        {
          property: "Todoist",
          number: {
            is_not_empty: true,
          },
        },
      ],
    },
  });
  const tasksCompletedOnNotion = await notion.databases.query({
    database_id,
    filter: {
      and: [
        {
          property: "Status",
          select: {
            equals: "Submitted",
          },
        },
        {
          property: "Todoist",
          number: {
            is_not_empty: true,
          },
        },
      ],
    },
  });
  const tasksCreatedOnNotion = await notion.databases.query({
    database_id,
    filter: {
      and: [
        {
          property: "Status",
          select: {
            does_not_equal: "Submitted",
          },
        },
        {
          property: "Todoist",
          number: {
            is_empty: true,
          },
        },
      ],
    },
  });

  todoistTasks.forEach(async (todoistTask) => {
    if (alreadyLoadedTasks.includes(todoistTask.id)) {
    } else {
      const project = await todoist.getProject(todoistTask.projectId);
      const section =
        todoistTask.sectionId &&
        (await todoist.getSection(todoistTask.sectionId));
      console.log(
        "Project/Section Name:",
        project.name,
        section.name,
        todoistTask.projectId,
        todoistTask.sectionId
      );
      console.log("Creating task:", todoistTask.content);

      await notion.pages.create({
        parent: { database_id },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: todoistTask.content,
                },
              },
            ],
          },
          Todoist: {
            number: todoistTask.id,
          },
          ...(todoistTask.due && {
            "Due Date": {
              date: { start: todoistTask.due.date },
            },
          }),
          Project: {
            select: {
              name: project.name,
            },
          },
          ...(section && {
            Section: {
              select: {
                name: section.name,
              },
            },
          }),
          Status: {
            select: {
              name: "Not Started",
            },
          },
        },
      });
    }
  });

  notionUncompletedTasks.results.forEach(async (notionTask) => {
    if (!todoistTaskIds.includes(notionTask.properties.Todoist.number)) {
      console.log(
        "Submitting task on notion:",
        notionTask.properties.Name.title[0].text.content
      );
      await notion.pages.update({
        page_id: notionTask.id,
        properties: {
          Todoist: { number: null },
          Status: {
            select: {
              name: "Submitted",
            },
          },
        },
      });
    }
  });

  tasksCompletedOnNotion.results.forEach((task) => {
    console.log(
      "Completing task on todoist:",
      task.properties.Name.title[0].text.content
    );
    todoist.closeTask(task.properties.Todoist.number);
    // remove todoist id from notion task
    notion.pages.update({
      page_id: task.id,
      properties: {
        Todoist: null,
      },
    });
  });

  // copy the task created on notion to todoist
  tasksCreatedOnNotion.results.forEach(async (task) => {
    const projectName =
      task.properties.Project.select && task.properties.Project.select.name;
    const sectionName =
      task.properties.Section.select && task.properties.Section.select.name;
    const dueDate =
      task.properties["Due Date"] && task.properties["Due Date"].date;
    const content = task.properties.Name.title[0].text.content;
    const projectId =
      projectName &&
      todoistProjects.find((project) => project.name === projectName).id;
    const sectionId =
      sectionName &&
      todoistSections.find((section) => section.name === sectionName).id;
    console.log("Creating task on todoist:", content);
    const todoistTask = await todoist.addTask({
      content,
      projectId,
      sectionId,
      dueDate,
    });
    await notion.pages.update({
      page_id: task.id,
      properties: {
        Todoist: { number: todoistTask.id },
        ...(projectId || { Project: { select: { name: "Inbox" } } }),
      },
    });
  });
}

setInterval(syncTasks, 10000);
