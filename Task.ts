interface TaskProps {
  title: string;
  todoistProjectId: number;
  todoistSectionId: number;
  todoistTaskId: number;
  dueDate: Date;
  notionTaskId: number;
}

class Task {
  title: string;
  todoistProjectId: number;
  todoistSectionId: number;
  todoistTaskId: number;
  dueDate: Date;
  notionTaskId: number;




  constructor({title, todoistProjectId, todoistSectionId, todoistTaskId, dueDate, notionTaskId}: TaskProps) {
    this.title = title;
    this.todoistProjectId = todoistProjectId;
    this.todoistSectionId = todoistSectionId;
    this.todoistTaskId = todoistTaskId;
    this.dueDate = dueDate;
    this.notionTaskId = notionTaskId;
  }

  

}