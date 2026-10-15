import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import type { Metrics, TraceEvent } from "../agents/types.js";
import {
  ChatTimeoutError,
  ModelUnavailableError,
  NotFoundError,
  toBoundaryMessage,
} from "../errors.js";
import { createRequestLogger, type RequestLogger } from "../obs/logger.js";
import { modelFromTrace, routeFromTrace, sinceToMs } from "../obs/request-stats.js";
import type { ConversationStore } from "../store/conversation-store.js";
import { MemoryConversationStore } from "../store/memory-conversation-store.js";
import type { MemoryStore } from "../memory-store.js";
import {
  SqliteRequestTraceStore,
  type RequestTraceStore,
} from "../store/request-trace-store.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";
import { decisionTurn } from "../services/decision-turn.js";
import { runChat, type ChatInput, type ChatOutput, type RunChatDeps } from "../services/run-chat.js";
import {
  PRODUCTION_ROUTES,
  type ProductionGraphDeps,
  type ProductionRoute,
} from "../graph/production-Graph.js";
import type { LearningReflectorDeps } from "../services/learning-reflector.js";
import type { HistorySummarizer } from "../services/history-summarizer.js";

export const CHAT_TIMEOUT_MS = 180_000;

export const chatRequestSchema = z
  .object({
    message: z.string().trim().min(1),
    strategy: z.string().trim().min(1).optional(),
    reflect: z.boolean().default(false),
    conversationId: z.string().trim().min(1).optional(),
    userId: z.string().trim().min(1).optional(),
  })
  .strict();

const chatDecisionSchema = z
  .object({
    conversationId: z.string().trim().min(1),
    decision: z.enum(["approve", "deny"]),
  })
  .strict();

const chatInboundSchema = z.union([chatRequestSchema, chatDecisionSchema]);

const PERSIST_FAILURE_MESSAGE = "Não foi possível gravar o trace do pedido.";
const requestIdSchema = z.string().uuid();

export interface ChatServerDependencies extends ProductionGraphDeps {
  timeoutMs?: number;
  conversationStore?: ConversationStore;
  memoryStore?: MemoryStore;
  learning?: LearningReflectorDeps;
  summarizer?: HistorySummarizer;
  baseTools?: readonly unknown[];
  requestTraceStore?: RequestTraceStore;
  requestLogger?: RequestLogger;
  /** Substitui runChat em testes que precisam de um trace vazio. */
  executeTurn?: (input: ChatInput, deps: RunChatDeps) => Promise<ChatOutput>;
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

function requestIdOf(response: Response): string {
  const current = response.locals.requestId;
  if (typeof current === "string" && current.length > 0) {
    return current;
  }
  const generated = randomUUID();
  response.locals.requestId = generated;
  return generated;
}

function finishPost(
  response: Response,
  status: number,
  body: Record<string, unknown>,
  logger: RequestLogger,
  trace?: readonly TraceEvent[],
  metrics?: Metrics,
): void {
  const requestId = requestIdOf(response);
  response.setHeader("X-Request-Id", requestId);
  try {
    if (status === 200) {
      (trace ?? []).forEach((event, seq) => {
        logger.traceEvent({
          requestId,
          seq,
          type: event.type,
          node: event.node ?? "",
        });
      });
      logger.request({ requestId, status, metrics });
    } else {
      logger.request({ requestId, status });
    }
  } catch {
    // Falha do sink não muda o status já decidido.
  }
  response.status(status).json({ requestId, ...body });
}

function recordError(
  store: RequestTraceStore,
  response: Response,
  conversationId: string | undefined,
): void {
  try {
    store.save({
      requestId: requestIdOf(response),
      conversationId: conversationId && conversationId.length > 0 ? conversationId : "-",
      metrics: { llmCalls: 0, latencyMs: 0, promptTokens: 0 },
      trace: [],
      status: "error",
      route: "",
      model: process.env.OPENROUTER_MODEL?.trim() ?? "",
    });
  } catch {
    // A resposta de erro não depende de a linha entrar no agregado.
  }
}

export function createChatServer(
  dependencies: ChatServerDependencies = {},
): Express {
  const app = express();
  const timeoutMs = dependencies.timeoutMs ?? CHAT_TIMEOUT_MS;
  const conversationStore =
    dependencies.conversationStore ?? new MemoryConversationStore();
  const memoryStore = dependencies.memoryStore;
  const learning = dependencies.learning;
  const summarizer = dependencies.summarizer;
  const baseTools = dependencies.baseTools;
  const requestTraceStore =
    dependencies.requestTraceStore ??
    new SqliteRequestTraceStore(new SqliteOpsStore(":memory:").db);
  const requestLogger = dependencies.requestLogger ?? createRequestLogger();
  const executeTurn = dependencies.executeTurn ?? runChat;

  app.use((request, response, next) => {
    if (request.path !== "/chat") {
      next();
      return;
    }
    const origin = request.get("origin");
    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "POST");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.status(204).end();
      return;
    }
    next();
  });
  app.use((request, response, next) => {
    if (request.method === "POST" && request.path === "/chat") {
      response.locals.requestId = randomUUID();
    }
    next();
  });
  app.use(express.json());

  app.post("/chat", async (request, response) => {
    const parsed = chatInboundSchema.safeParse(request.body);
    if (!parsed.success) {
      finishPost(response, 400, { issues: parsed.error.issues }, requestLogger);
      return;
    }

    if ("decision" in parsed.data) {
      const { conversationId, decision } = parsed.data;
      try {
        conversationStore.lastMessages(conversationId, 1);
      } catch (error) {
        if (error instanceof NotFoundError) {
          finishPost(
            response,
            404,
            { error: { code: error.code, message: error.message } },
            requestLogger,
          );
          return;
        }
        const boundary = toBoundaryMessage(error);
        finishPost(
          response,
          500,
          {
            error: {
              code: "INTERNAL_ERROR",
              message: boundary ?? "Erro inesperado durante a execução do chat.",
            },
          },
          requestLogger,
        );
        return;
      }

      const turn = decisionTurn(decision);
      try {
        requestTraceStore.save({
          requestId: requestIdOf(response),
          conversationId,
          metrics: turn.metrics,
          trace: turn.trace,
          status: "ok",
        });
      } catch {
        finishPost(
          response,
          500,
          {
            error: {
              code: "INTERNAL_ERROR",
              message: PERSIST_FAILURE_MESSAGE,
            },
          },
          requestLogger,
        );
        return;
      }
      conversationStore.append(conversationId, { role: "user", content: turn.userLine });
      conversationStore.append(conversationId, { role: "assistant", content: turn.answer });
      finishPost(
        response,
        200,
        {
          conversationId,
          answer: turn.answer,
          trace: turn.trace,
          metrics: turn.metrics,
        },
        requestLogger,
        turn.trace,
        turn.metrics,
      );
      return;
    }

    const {
      message,
      strategy: strategyName,
      reflect,
      conversationId,
      userId,
    } = parsed.data;
    if (
      strategyName !== undefined &&
      !(PRODUCTION_ROUTES as readonly string[]).includes(strategyName)
    ) {
      finishPost(
        response,
        422,
        {
          error: {
            code: "UNKNOWN_STRATEGY",
            message: `Estratégia desconhecida: "${strategyName}".`,
          },
        },
        requestLogger,
      );
      return;
    }

    try {
      const result = await runWithTimeout(
        executeTurn(
          {
            message,
            conversationId,
            userId,
            strategy: strategyName as ProductionRoute | undefined,
            reflect,
          },
          {
            conversation: conversationStore,
            memory: memoryStore,
            learning,
            summarizer,
            baseTools,
            strategies: dependencies.strategies,
            routeModel: dependencies.routeModel,
            critic: dependencies.critic,
          },
        ),
        timeoutMs,
      );
      try {
        requestTraceStore.save({
          requestId: requestIdOf(response),
          conversationId: result.conversationId,
          metrics: result.metrics,
          trace: result.trace,
          route: routeFromTrace(result.trace),
          model: modelFromTrace(result.trace),
          status: "ok",
        });
      } catch {
        finishPost(
          response,
          500,
          {
            error: {
              code: "INTERNAL_ERROR",
              message: PERSIST_FAILURE_MESSAGE,
            },
          },
          requestLogger,
        );
        return;
      }
      finishPost(
        response,
        200,
        {
          conversationId: result.conversationId,
          answer: result.answer,
          trace: result.trace,
          metrics: result.metrics,
        },
        requestLogger,
        result.trace,
        result.metrics,
      );
    } catch (error) {
      if (error instanceof ChatTimeoutError) {
        recordError(requestTraceStore, response, conversationId);
        finishPost(
          response,
          504,
          { error: { code: error.code, message: error.message } },
          requestLogger,
        );
        return;
      }

      if (error instanceof ModelUnavailableError) {
        recordError(requestTraceStore, response, conversationId);
        finishPost(
          response,
          503,
          { error: { code: error.code, message: error.message } },
          requestLogger,
        );
        return;
      }

      if (error instanceof NotFoundError) {
        recordError(requestTraceStore, response, conversationId);
        finishPost(
          response,
          404,
          { error: { code: error.code, message: error.message } },
          requestLogger,
        );
        return;
      }

      const boundary = toBoundaryMessage(error);
      recordError(requestTraceStore, response, conversationId);
      finishPost(
        response,
        500,
        {
          error: {
            code: "INTERNAL_ERROR",
            message: boundary ?? "Erro inesperado durante a execução do chat.",
          },
        },
        requestLogger,
      );
    }
  });

  app.get("/stats", (request, response) => {
    const raw = request.query.since;
    if (raw !== undefined && typeof raw !== "string") {
      response.status(400).json({
        issues: [{ code: "custom", path: ["since"], message: "since deve ser uma duração como 24h." }],
      });
      return;
    }
    const since = (raw ?? "24h").trim().toLowerCase();
    const sinceMs = sinceToMs(since);
    if (sinceMs === null) {
      response.status(400).json({
        issues: [{
          code: "custom",
          path: ["since"],
          message: "since deve ser uma duração como 24h, 30m ou 7d.",
        }],
      });
      return;
    }
    response.status(200).json(requestTraceStore.stats(since, sinceMs));
  });

  app.get("/requests/:id", (request, response) => {
    const raw = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const parsed = requestIdSchema.safeParse((raw ?? "").trim());
    if (!parsed.success) {
      response.status(400).json({ issues: parsed.error.issues });
      return;
    }

    const record = requestTraceStore.findById(parsed.data);
    if (!record) {
      const error = new NotFoundError("Pedido não encontrado.");
      response.status(404).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }

    response.status(200).json(record);
  });

  app.use(function badJsonResponse(
    error: unknown,
    _request: Request,
    response: Response,
    next: (error: unknown) => void,
  ): void {
    if (error instanceof SyntaxError && "body" in error) {
      finishPost(
        response,
        400,
        {
          issues: [{ code: "invalid_json", path: [], message: "Corpo JSON inválido." }],
        },
        requestLogger,
      );
      return;
    }
    next(error);
  });
  return app;
}
