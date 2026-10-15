import { ZodError } from "zod";

import { isDomainError } from "../domain/errors.js";
import {
  createTaskInputSchema,
  listTasksInputSchema,
  taskFilterSchema,
  taskIdSchema,
  type Task
} from "../domain/task.js";
import { mapDomainErrorToCli } from "./error-mapper.js";

type TaskServiceContract = {
  create(input: { title: string }): Task;
  list(filter?: "all" | "open" | "done"): Task[];
  complete(taskId: number): Task;
  remove(taskId: number): Task;
};

export type CliExecutionResult = {
  exitCode: number;
  stdout: string[];
  stderr: string[];
};

function success(...stdout: string[]): CliExecutionResult {
  return { exitCode: 0, stdout, stderr: [] };
}

function failure(message: string, exitCode = 1): CliExecutionResult {
  return { exitCode, stdout: [], stderr: [message] };
}

function formatTask(task: Task): string {
  return `${task.id}. [${task.status}] ${task.title}`;
}

function parseFlag(args: string[], flagName: string): string | undefined {
  const flagIndex = args.indexOf(flagName);
  if (flagIndex < 0) {
    return undefined;
  }

  return args[flagIndex + 1];
}

function parseIdFlag(args: string[]): number {
  const rawId = parseFlag(args, "--id");
  const rawAsNumber = Number(rawId);

  return taskIdSchema.parse(rawAsNumber);
}

function parseListFilter(args: string[]): "all" | "open" | "done" {
  const rawFilter = parseFlag(args, "--filter");
  const parsedFilter = listTasksInputSchema.parse({ filter: rawFilter }).filter;

  return taskFilterSchema.parse(parsedFilter);
}

function parseCreateTitle(args: string[]): string {
  const rawTitle = parseFlag(args, "--title");
  return createTaskInputSchema.parse({ title: rawTitle }).title;
}

export function runCliCommand(args: string[], service: TaskServiceContract): CliExecutionResult {
  try {
    if (args[0] !== "tasks") {
      return failure("Comando raiz inválido. Use: tasks <create|list|complete|remove>");
    }

    const command = args[1];

    if (command === "create") {
      const title = parseCreateTitle(args.slice(2));
      const created = service.create({ title });

      return success(`Tarefa criada: ${formatTask(created)}`);
    }

    if (command === "list") {
      const filter = parseListFilter(args.slice(2));
      const listed = service.list(filter);

      if (listed.length === 0) {
        return success("Nenhuma tarefa encontrada.");
      }

      return success(...listed.map((task) => formatTask(task)));
    }

    if (command === "complete") {
      const taskId = parseIdFlag(args.slice(2));
      const completed = service.complete(taskId);

      return success(`Tarefa concluída: ${formatTask(completed)}`);
    }

    if (command === "remove") {
      const taskId = parseIdFlag(args.slice(2));
      const removed = service.remove(taskId);

      return success(`Tarefa removida: ${formatTask(removed)}`);
    }

    return failure("Comando inválido. Use: tasks <create|list|complete|remove>");
  } catch (error) {
    if (error instanceof ZodError) {
      return failure("Entrada inválida para o comando informado.");
    }

    if (isDomainError(error)) {
      const mapped = mapDomainErrorToCli(error);
      return failure(mapped.message, mapped.exitCode);
    }

    return failure("Erro interno ao executar comando.");
  }
}
