export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class TaskNotFoundError extends DomainError {
  readonly code = "TASK_NOT_FOUND";

  constructor(taskId: number) {
    super(`Task with id ${taskId} was not found`);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
