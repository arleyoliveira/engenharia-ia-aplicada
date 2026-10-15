import type { Task, TaskFilter } from "../domain/task.js";

type CreateTaskParams = {
  title: string;
};

export class InMemoryTaskStore {
  private readonly tasks: Task[] = [];
  private nextId = 1;

  create(params: CreateTaskParams): Task {
    const task: Task = {
      id: this.nextId,
      title: params.title,
      status: "open"
    };

    this.tasks.push(task);
    this.nextId += 1;

    return { ...task };
  }

  list(filter: TaskFilter): Task[] {
    if (filter === "all") {
      return this.tasks.map((task) => ({ ...task }));
    }

    return this.tasks
      .filter((task) => task.status === filter)
      .map((task) => ({ ...task }));
  }

  findById(taskId: number): Task | undefined {
    const found = this.tasks.find((task) => task.id === taskId);

    if (!found) {
      return undefined;
    }

    return { ...found };
  }

  complete(taskId: number): Task | undefined {
    const task = this.tasks.find((item) => item.id === taskId);

    if (!task) {
      return undefined;
    }

    task.status = "done";

    return { ...task };
  }

  remove(taskId: number): Task | undefined {
    const taskIndex = this.tasks.findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return undefined;
    }

    const [removedTask] = this.tasks.splice(taskIndex, 1);

    return { ...removedTask };
  }
}
