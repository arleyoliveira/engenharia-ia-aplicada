import type { Task, TaskFilter } from "../domain/task.js";
import { emptyPersistedTasks } from "../domain/persisted-tasks.js";
import {
  loadPersistedTasksFileSync,
  writePersistedTasksFileSync
} from "./persisted-tasks-file.js";

type CreateTaskParams = {
  title: string;
};

export type FileTaskStoreRecovery = {
  backupPath: string;
};

type FileTaskStoreOptions = {
  onRecovery?: (event: FileTaskStoreRecovery) => void;
};

function cloneTask(task: Task): Task {
  return { ...task };
}

export class FileTaskStore {
  private state = emptyPersistedTasks;
  private readonly onRecovery?: (event: FileTaskStoreRecovery) => void;

  constructor(
    private readonly filePath: string,
    options: FileTaskStoreOptions = {}
  ) {
    this.onRecovery = options.onRecovery;
    this.reloadState();
  }

  private reloadState(): void {
    const loaded = loadPersistedTasksFileSync(this.filePath);
    this.state = {
      nextId: loaded.state.nextId,
      tasks: loaded.state.tasks.map(cloneTask)
    };

    if (loaded.recoveredFromCorruption && loaded.backupPath && this.onRecovery) {
      this.onRecovery({ backupPath: loaded.backupPath });
    }
  }

  private persist(): void {
    writePersistedTasksFileSync(this.filePath, this.state);
  }

  create(params: CreateTaskParams): Task {
    this.reloadState();

    const task: Task = {
      id: this.state.nextId,
      title: params.title,
      status: "open"
    };

    this.state = {
      nextId: this.state.nextId + 1,
      tasks: [...this.state.tasks, task]
    };

    this.persist();
    return cloneTask(task);
  }

  list(filter: TaskFilter): Task[] {
    this.reloadState();

    if (filter === "all") {
      return this.state.tasks.map(cloneTask);
    }

    return this.state.tasks.filter((task) => task.status === filter).map(cloneTask);
  }

  findById(taskId: number): Task | undefined {
    this.reloadState();

    const found = this.state.tasks.find((task) => task.id === taskId);
    return found ? cloneTask(found) : undefined;
  }

  complete(taskId: number): Task | undefined {
    this.reloadState();

    const taskIndex = this.state.tasks.findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return undefined;
    }

    const updated: Task = {
      ...this.state.tasks[taskIndex],
      status: "done"
    };

    const nextTasks = [...this.state.tasks];
    nextTasks[taskIndex] = updated;
    this.state = {
      nextId: this.state.nextId,
      tasks: nextTasks
    };

    this.persist();
    return cloneTask(updated);
  }

  remove(taskId: number): Task | undefined {
    this.reloadState();

    const taskIndex = this.state.tasks.findIndex((task) => task.id === taskId);

    if (taskIndex < 0) {
      return undefined;
    }

    const removedTask = this.state.tasks[taskIndex];
    const nextTasks = this.state.tasks.filter((task) => task.id !== taskId);
    this.state = {
      nextId: this.state.nextId,
      tasks: nextTasks
    };

    this.persist();
    return cloneTask(removedTask);
  }
}
