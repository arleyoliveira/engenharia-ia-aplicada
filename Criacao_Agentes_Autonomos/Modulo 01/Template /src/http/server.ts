import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { ZodError } from "zod";

import { isDomainError } from "../domain/errors.js";
import { createTaskInputSchema, taskIdSchema } from "../domain/task.js";
import { mapDomainErrorToHttp } from "./error-mapper.js";

type TaskServiceContract = {
  create(input: { title: string }): { id: number; title: string; status: "open" | "done" };
  list(filter?: "all" | "open" | "done"): Array<{ id: number; title: string; status: "open" | "done" }>;
  complete(taskId: number): { id: number; title: string; status: "open" | "done" };
  remove(taskId: number): { id: number; title: string; status: "open" | "done" };
};

type JsonErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    connection: "close"
  });
  response.end(payload);
}

function sendJsonError(response: ServerResponse, status: number, code: string, message: string): void {
  const body: JsonErrorBody = {
    error: {
      code,
      message
    }
  };

  sendJson(response, status, body);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");

  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody);
}

function parseTaskIdFromPath(pathname: string, suffix?: string): number | undefined {
  const base = "/tasks/";
  if (!pathname.startsWith(base)) {
    return undefined;
  }

  const tail = pathname.slice(base.length);
  if (!tail) {
    return undefined;
  }

  if (suffix) {
    if (!tail.endsWith(suffix)) {
      return undefined;
    }

    const idPart = tail.slice(0, -suffix.length);
    if (!idPart) {
      return undefined;
    }

    return Number(idPart);
  }

  if (tail.includes("/")) {
    return undefined;
  }

  return Number(tail);
}

export function createTaskHttpServer(service: TaskServiceContract): Server {
  return createServer(async (request, response) => {
    try {
      const method = request.method ?? "GET";
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      const pathname = requestUrl.pathname;

      if (method === "POST" && pathname === "/tasks") {
        const body = await readJsonBody(request);
        const parsed = createTaskInputSchema.parse(body);
        const created = service.create(parsed);
        return sendJson(response, 201, created);
      }

      if (method === "GET" && pathname === "/tasks") {
        const rawFilter = requestUrl.searchParams.get("filter") ?? undefined;
        const listed = service.list(rawFilter as "all" | "open" | "done" | undefined);
        return sendJson(response, 200, listed);
      }

      if (method === "PATCH") {
        const taskId = parseTaskIdFromPath(pathname, "/complete");
        if (taskId !== undefined) {
          const parsedTaskId = taskIdSchema.parse(taskId);
          const completed = service.complete(parsedTaskId);
          return sendJson(response, 200, completed);
        }
      }

      if (method === "DELETE") {
        const taskId = parseTaskIdFromPath(pathname);
        if (taskId !== undefined) {
          const parsedTaskId = taskIdSchema.parse(taskId);
          service.remove(parsedTaskId);
          response.writeHead(204, { connection: "close" });
          response.end();
          return;
        }
      }

      sendJsonError(response, 404, "NOT_FOUND", "Route not found");
    } catch (error) {
      if (error instanceof ZodError) {
        return sendJsonError(response, 400, "VALIDATION_ERROR", "Invalid input");
      }

      if (isDomainError(error)) {
        const mapped = mapDomainErrorToHttp(error);
        return sendJson(response, mapped.status, mapped.body);
      }

      return sendJsonError(response, 500, "INTERNAL_ERROR", "Internal server error");
    }
  });
}
