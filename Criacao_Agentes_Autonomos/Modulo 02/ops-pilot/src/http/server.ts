import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import { ChatTimeoutError, toBoundaryMessage } from "../errors.js";
import { strategyRegistry, type StrategyRegistry } from "../agents/index.js";

export const CHAT_TIMEOUT_MS = 180_000;

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1),
    strategy: z.string().trim().min(1).default("react"),
    reflect: z.boolean().default(false),
  })
  .strict();

export interface ChatServerDependencies {
  registry?: StrategyRegistry;
  timeoutMs?: number;
}

export function runWithTimeout<T>(
  task: Promise<T>,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ChatTimeoutError(timeoutMs));
    }, timeoutMs);

    task.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function badJsonResponse(error: unknown, _request: Request, response: Response, next: (error: unknown) => void): void {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      issues: [{ code: "invalid_json", path: [], message: "Corpo JSON inválido." }],
    });
    return;
  }
  next(error);
}

export function createChatServer(
  dependencies: ChatServerDependencies = {},
): Express {
  const app = express();
  const registry = dependencies.registry ?? strategyRegistry;
  const timeoutMs = dependencies.timeoutMs ?? CHAT_TIMEOUT_MS;

  app.use(express.json());

  app.post("/chat", async (request, response) => {
    const parsed = chatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ issues: parsed.error.issues });
      return;
    }

    const { message, strategy: strategyName, reflect } = parsed.data;
    const strategy = registry.resolve(strategyName, reflect);
    if (!strategy) {
      response.status(422).json({
        error: {
          code: "UNKNOWN_STRATEGY",
          message: `Estratégia desconhecida: "${strategyName}".`,
        },
      });
      return;
    }

    try {
      const result = await runWithTimeout(strategy.run(message), timeoutMs);
      response.status(200).json(result);
    } catch (error) {
      if (error instanceof ChatTimeoutError) {
        response.status(504).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }

      const boundary = toBoundaryMessage(error);
      response.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: boundary ?? "Erro inesperado durante a execução do chat.",
        },
      });
    }
  });

  app.use(badJsonResponse);
  return app;
}
