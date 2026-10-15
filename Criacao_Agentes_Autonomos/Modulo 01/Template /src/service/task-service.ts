import { TaskNotFoundError } from "../domain/errors.js";
import {
  createTaskInputSchema,
  listTasksInputSchema,
  taskIdSchema,
  type CreateTaskInput,
  type Task,
  type TaskFilter
} from "../domain/task.js";

type TaskStore = Pick<
  {
    create(params: { title: string }): Task;
    list(filter: TaskFilter): Task[];
    complete(taskId: number): Task | undefined;
    remove(taskId: number): Task | undefined;
  },
  "create" | "list" | "complete" | "remove"
>;

export class TaskService {
  constructor(private readonly store: TaskStore) {}

  create(input: CreateTaskInput): Task {
    const parsed = createTaskInputSchema.parse(input);

    return this.store.create({ title: parsed.title });
  }

  list(filter?: TaskFilter): Task[] {
    const parsed = listTasksInputSchema.parse({ filter });

    return this.store.list(parsed.filter);
  }

  complete(taskId: number): Task {
    const parsedTaskId = taskIdSchema.parse(taskId);
    const completed = this.store.complete(parsedTaskId);

    if (!completed) {
      throw new TaskNotFoundError(parsedTaskId);
    }

    return completed;
  }

  remove(taskId: number): Task {
    const parsedTaskId = taskIdSchema.parse(taskId);
    const removed = this.store.remove(parsedTaskId);

    if (!removed) {
      throw new TaskNotFoundError(parsedTaskId);
    }

    return removed;
  }
}
