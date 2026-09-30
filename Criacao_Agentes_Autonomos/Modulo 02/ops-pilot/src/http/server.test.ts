import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { ModelUnavailableError, NotFoundError } from "../errors.js";
import { createChatServer } from "./server.js";
import type { ReasoningStrategy, StrategyInput } from "../agents/types.js";
import type { ProductionRoute, RouteModel } from "../graph/production-Graph.js";
import { MemoryConversationStore } from "../store/memory-conversation-store.js";
import { InMemoryMemoryStore } from "../memory-store.js";
import {
  HISTORY_WINDOW,
  normalizeChatTurnInput,
  PRUNE_BATCH_SIZE,
} from "../services/compose-chat-prompt.js";
import { createFakeHistorySummarizer } from "../services/history-summarizer.js";
import { createRequestLogger } from "../obs/logger.js";
import { emptyRequestStats } from "../obs/request-stats.js";
import type { RequestTraceStore } from "../store/request-trace-store.js";
import { SqliteRequestTraceStore } from "../store/request-trace-store.js";
import { SqliteOpsStore } from "../store/sqlite-ops-store.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const immediateStrategy: ReasoningStrategy & {
  lastInput: StrategyInput | null;
} = {
  name: "fake",
  lastInput: null,
  async run(input: StrategyInput) {
    immediateStrategy.lastInput = input;
    const turn = normalizeChatTurnInput(input);
    return {
      answer: `Resposta para: ${turn.message}`,
      trace: [{ type: "answer", content: `Resposta para: ${turn.message}` }],
      metrics: { llmCalls: 0, latencyMs: 1 },
    };
  },
};

function idleStrategy(name: string): ReasoningStrategy & { runs: number } {
  const strategy = {
    name,
    runs: 0,
    async run() {
      strategy.runs += 1;
      return {
        answer: name,
        trace: [{ type: "answer" as const, content: name }],
        metrics: { llmCalls: 0, latencyMs: 1 },
      };
    },
  };
  return strategy;
}

function reactRouter(): RouteModel & { calls: number } {
  const model = {
    calls: 0,
    async invoke() {
      model.calls += 1;
      return { route: "react" satisfies ProductionRoute, reason: "consulta curta" };
    },
  };
  return model;
}

describe("POST /chat", () => {
  const planExecute = idleStrategy("planExecute");
  const reflect = idleStrategy("reflect");
  const team = idleStrategy("team");
  const routeModel = reactRouter();
  const conversationStore = new MemoryConversationStore();
  const memoryStore = new InMemoryMemoryStore();
  memoryStore.seedRecall("ops-alice", ["prefiro alertas em português"]);
  const app = createChatServer({
    timeoutMs: 20,
    strategies: {
      react: immediateStrategy,
      planExecute,
      reflect,
      team,
    },
    routeModel,
    conversationStore,
    memoryStore,
    baseTools: [],
    learning: {
      distill: async () => ({ hasLearning: false, fact: "" }),
    },
  });
  const server = createServer(app);
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function post(body: unknown): Promise<Response> {
    return fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("retorna 200 para message válida usando os defaults", async () => {
    const response = await post({ message: "status" });
    const body = await response.json() as {
      requestId: string;
      answer: string;
      conversationId: string;
      metrics: {
        historyMessages: number;
        llmCalls: number;
        latencyMs: number;
        promptTokens: number;
        contextBreakdown: {
          message: number;
          history: number;
          memories: number;
          summary: number;
        };
      };
    };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), body.requestId);
    assert.match(body.requestId, UUID);
    assert.equal(body.answer, "Resposta para: status");
    assert.ok(body.conversationId.length > 0);
    assert.equal(body.metrics.historyMessages, 0);
    assert.equal(body.metrics.llmCalls, 1);
    assert.equal(body.metrics.promptTokens, 0);
    assert.equal(typeof body.metrics.contextBreakdown.message, "number");
    assert.equal(typeof body.metrics.contextBreakdown.history, "number");
    assert.equal(typeof body.metrics.contextBreakdown.memories, "number");
    assert.equal(typeof body.metrics.contextBreakdown.summary, "number");
    assert.ok(body.metrics.contextBreakdown.message >= 0);
    assert.equal(body.metrics.contextBreakdown.history, 0);
    assert.equal(body.metrics.contextBreakdown.memories, 0);
    assert.equal(body.metrics.contextBreakdown.summary, 0);
    const traced = await post({ message: "status-rota" });
    const tracedBody = (await traced.json()) as {
      requestId: string;
      trace: Array<{ type: string; override?: boolean; route?: string }>;
    };
    assert.notEqual(tracedBody.requestId, body.requestId);
    const routeEvent = tracedBody.trace.find((event) => event.type === "route");
    assert.equal(routeEvent?.override, false);
    assert.equal(routeEvent?.route, "react");
  });

  it("continua conversa com conversationId e historyMessages > 0", async () => {
    const first = await post({ message: "primeiro" });
    const firstBody = await first.json() as { conversationId: string };
    assert.equal(first.status, 200);

    const second = await post({
      message: "segundo",
      conversationId: firstBody.conversationId,
    });
    const secondBody = await second.json() as {
      conversationId: string;
      metrics: { historyMessages: number };
    };

    assert.equal(second.status, 200);
    assert.equal(secondBody.conversationId, firstBody.conversationId);
    assert.ok(secondBody.metrics.historyMessages >= 1);
  });

  it("retorna 404 para conversationId inexistente", async () => {
    const response = await post({
      message: "status",
      conversationId: "00000000-0000-0000-0000-000000000000",
    });

    assert.equal(response.status, 404);
    const missing = (await response.json()) as {
      requestId: string;
      error: { code: string; message: string };
    };
    assert.equal(missing.error.code, "NOT_FOUND");
    assert.equal(
      missing.error.message,
      'Conversa não encontrada: "00000000-0000-0000-0000-000000000000"',
    );
    assert.equal(response.headers.get("x-request-id"), missing.requestId);
  });

  it("retorna 400 para conversationId vazio", async () => {
    const response = await post({ message: "status", conversationId: "   " });
    const body = await response.json() as { issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
  });

  it("strategy planExecute é override e não chama o roteador", async () => {
    const before = routeModel.calls;
    const response = await post({ message: "revisar", strategy: "planExecute" });
    const body = (await response.json()) as {
      answer: string;
      trace: Array<{ type: string; override?: boolean; route?: string; reason?: string }>;
    };

    assert.equal(response.status, 200);
    assert.equal(routeModel.calls, before);
    assert.equal(planExecute.runs, 1);
    assert.equal(body.answer, "planExecute");
    const routeEvent = body.trace.find((event) => event.type === "route");
    assert.equal(routeEvent?.override, true);
    assert.equal(routeEvent?.route, "planExecute");
    assert.equal(routeEvent?.reason, "estratégia informada pelo cliente");
  });

  it("strategy team é override e não chama o roteador", async () => {
    const before = routeModel.calls;
    const runsBefore = team.runs;
    const response = await post({ message: "montar equipe", strategy: "team" });
    const body = (await response.json()) as {
      answer: string;
      trace: Array<{ type: string; override?: boolean; route?: string }>;
    };

    assert.equal(response.status, 200);
    assert.equal(routeModel.calls, before);
    assert.equal(team.runs, runsBefore + 1);
    assert.equal(body.answer, "team");
    const routeEvent = body.trace.find((event) => event.type === "route");
    assert.equal(routeEvent?.override, true);
    assert.equal(routeEvent?.route, "team");
  });

  it("strategy vazia é 400", async () => {
    const response = await post({ message: "status", strategy: "" });
    const body = (await response.json()) as { issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
  });

  it("retorna 400 com issues Zod para body inválido", async () => {
    const response = await post({ message: "", reflect: "true" });
    const body = await response.json() as { issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
  });

  it("ignora X-Request-Id de entrada e rejeita requestId no corpo", async () => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "cliente-nao-entra",
      },
      body: JSON.stringify({ message: "status", requestId: "tambem-nao" }),
    });
    const body = (await response.json()) as { requestId: string; issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
    assert.match(body.requestId, UUID);
    assert.notEqual(body.requestId, "cliente-nao-entra");
    assert.notEqual(body.requestId, "tambem-nao");
    assert.equal(response.headers.get("x-request-id"), body.requestId);
  });

  it("retorna 400 com issues para JSON malformado", async () => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const body = await response.json() as { requestId: string; issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
    assert.equal(response.headers.get("x-request-id"), body.requestId);
  });

  it("retorna 422 para estratégia desconhecida", async () => {
    const response = await post({ message: "status", strategy: "missing" });

    assert.equal(response.status, 422);
    const unknown = (await response.json()) as {
      requestId: string;
      error: { code: string; message: string };
    };
    assert.equal(unknown.error.code, "UNKNOWN_STRATEGY");
    assert.equal(unknown.error.message, 'Estratégia desconhecida: "missing".');
    assert.equal(response.headers.get("x-request-id"), unknown.requestId);
  });

  it("com userId injeta memórias e recalledMemories", async () => {
    immediateStrategy.lastInput = null;
    const response = await post({
      message: "idioma das notificações?",
      userId: "ops-alice",
    });
    const body = await response.json() as {
      metrics: { recalledMemories: number };
    };

    assert.equal(response.status, 200);
    assert.equal(body.metrics.recalledMemories, 1);
    assert.ok(immediateStrategy.lastInput);
    assert.equal(typeof immediateStrategy.lastInput, "object");
    assert.deepEqual(
      (immediateStrategy.lastInput as { memories?: string[] }).memories,
      ["prefiro alertas em português"],
    );
  });

  it("retorna 400 para userId vazio", async () => {
    const response = await post({ message: "status", userId: "   " });
    const body = await response.json() as { issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
  });

  it("retorna 504 quando a estratégia excede o timeout", async () => {
    const timeoutServer = createServer(
      createChatServer({
        timeoutMs: 1,
        conversationStore: new MemoryConversationStore(),
        strategies: {
          react: {
            name: "slow",
            async run() {
              return new Promise(() => undefined);
            },
          },
          planExecute: idleStrategy("planExecute"),
          reflect: idleStrategy("reflect"),
          team: idleStrategy("team"),
        },
        routeModel: reactRouter(),
      }),
    );
    await new Promise<void>((resolve) => timeoutServer.listen(0, "127.0.0.1", resolve));
    const address = timeoutServer.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "status" }),
    });

    assert.equal(response.status, 504);
    const timedOut = (await response.json()) as {
      requestId: string;
      error: { code: string; message: string };
    };
    assert.equal(timedOut.error.code, "CHAT_TIMEOUT");
    assert.equal(timedOut.error.message, "A execução excedeu o limite de 1 ms.");
    assert.equal(response.headers.get("x-request-id"), timedOut.requestId);
    await new Promise<void>((resolve, reject) => timeoutServer.close((error) => error ? reject(error) : resolve()));
  });

  it("retorna 503 quando o modelo está indisponível", async () => {
    const unavailableServer = createServer(
      createChatServer({
        conversationStore: new MemoryConversationStore(),
        strategies: {
          react: {
            name: "unavailable",
            async run() {
              throw new ModelUnavailableError();
            },
          },
          planExecute: idleStrategy("planExecute"),
          reflect: idleStrategy("reflect"),
          team: idleStrategy("team"),
        },
        routeModel: reactRouter(),
      }),
    );
    await new Promise<void>((resolve) => unavailableServer.listen(0, "127.0.0.1", resolve));
    const address = unavailableServer.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "status" }),
    });

    assert.equal(response.status, 503);
    const unavailable = (await response.json()) as {
      requestId: string;
      error: { code: string; message: string };
    };
    assert.equal(unavailable.error.code, "MODEL_UNAVAILABLE");
    assert.equal(unavailable.error.message, "O modelo de linguagem está indisponível.");
    assert.equal(response.headers.get("x-request-id"), unavailable.requestId);
    await new Promise<void>((resolve, reject) => unavailableServer.close((error) => error ? reject(error) : resolve()));
  });
});

describe("POST /chat history summarization", () => {
  const conversationStore = new MemoryConversationStore();
  const summarizer = createFakeHistorySummarizer();
  const app = createChatServer({
    timeoutMs: 20,
    strategies: {
      react: immediateStrategy,
      planExecute: idleStrategy("planExecute"),
      reflect: idleStrategy("reflect"),
      team: idleStrategy("team"),
    },
    routeModel: reactRouter(),
    conversationStore,
    summarizer,
    baseTools: [],
  });
  const server = createServer(app);
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("conversa longa: historyMessages ≤ 8 e summarize no turn de consolidação", async () => {
    const id = conversationStore.create();
    for (let i = 0; i < HISTORY_WINDOW + PRUNE_BATCH_SIZE; i += 1) {
      conversationStore.append(id, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `m${i}`,
      });
    }

    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "continuar", conversationId: id }),
    });
    const body = (await response.json()) as {
      metrics: {
        historyMessages: number;
        contextBreakdown: { summary: number };
      };
      trace: Array<{ type: string }>;
    };

    assert.equal(response.status, 200);
    assert.ok(body.metrics.historyMessages <= 8);
    assert.equal(body.metrics.historyMessages, HISTORY_WINDOW);
    assert.equal(body.trace[0]?.type, "summarize");
    assert.ok(body.metrics.contextBreakdown.summary > 0);
  });
});

describe("POST /chat request trace", () => {
  const ops = new SqliteOpsStore(":memory:");
  const requestTraceStore = new SqliteRequestTraceStore(ops.db);
  const chunks: string[] = [];
  const requestLogger = createRequestLogger((line) => chunks.push(line));
  const app = createChatServer({
    timeoutMs: 20,
    strategies: {
      react: immediateStrategy,
      planExecute: idleStrategy("planPersist"),
      reflect: idleStrategy("reflect"),
      team: idleStrategy("team"),
    },
    routeModel: reactRouter(),
    conversationStore: new MemoryConversationStore(),
    baseTools: [],
    learning: {
      distill: async () => ({ hasLearning: false, fact: "" }),
    },
    requestTraceStore,
    requestLogger,
  });
  const server = createServer(app);
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  function countRequests(): number {
    const row = ops.db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number };
    return row.n;
  }

  it("persiste o 200 e o log não leva o payload", async () => {
    chunks.length = 0;
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "auditoria" }),
    });
    const body = (await response.json()) as {
      requestId: string;
      conversationId: string;
      trace: Array<{ type: string; content?: string; node?: string }>;
      metrics: { llmCalls: number };
    };

    assert.equal(response.status, 200);
    const stored = requestTraceStore.findById(body.requestId);
    assert.ok(stored);
    assert.equal(stored.conversationId, body.conversationId);
    assert.deepEqual(stored.metrics, body.metrics);
    assert.deepEqual(stored.trace, body.trace);

    const parsed = chunks.map((line) => JSON.parse(line) as { kind: string; seq?: number; status?: number });
    const events = parsed.filter((line) => line.kind === "trace");
    const summaries = parsed.filter((line) => line.kind === "request");
    assert.equal(events.length, body.trace.length);
    assert.deepEqual(events.map((line) => line.seq), body.trace.map((_, index) => index));
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0]?.status, 200);
    assert.equal(chunks.join("").includes("Resposta para: auditoria"), false);
  });

  it("erro de validação não grava e o log é só o resumo", async () => {
    chunks.length = 0;
    const before = countRequests();
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    const body = (await response.json()) as { requestId: string };
    assert.equal(response.status, 400);
    assert.equal(requestTraceStore.findById(body.requestId), null);
    assert.equal(countRequests(), before);
    const parsed = chunks.map((line) => JSON.parse(line) as { kind: string; status?: number; metrics?: unknown });
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]?.kind, "request");
    assert.equal(parsed[0]?.status, 400);
    assert.equal(Object.hasOwn(parsed[0] ?? {}, "metrics"), false);
  });
});

describe("POST /chat trace vazio e falha de gravação", () => {
  it("trace vazio grava o pedido e só emite o resumo", async () => {
    const ops = new SqliteOpsStore(":memory:");
    const requestTraceStore = new SqliteRequestTraceStore(ops.db);
    const chunks: string[] = [];
    const app = createChatServer({
      requestTraceStore,
      requestLogger: createRequestLogger((line) => chunks.push(line)),
      executeTurn: async () => ({
        conversationId: "77777777-7777-4777-8777-777777777777",
        answer: "sem trace",
        trace: [],
        metrics: { llmCalls: 0, latencyMs: 1, promptTokens: 0, fallbacks: 0 },
      }),
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "vazio" }),
    });
    const body = (await response.json()) as { requestId: string; trace: unknown[] };
    assert.equal(response.status, 200);
    assert.deepEqual(body.trace, []);
    assert.deepEqual(requestTraceStore.findById(body.requestId)?.trace, []);
    const parsed = chunks.map((line) => JSON.parse(line) as { kind: string });
    assert.deepEqual(parsed.map((line) => line.kind), ["request"]);

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("falha de save responde 500 e não deixa registro", async () => {
    const failing: RequestTraceStore = {
      save() {
        throw new Error("SQLITE_CONSTRAINT secret detail");
      },
      findById() {
        return null;
      },
      stats(since) {
        return emptyRequestStats(since);
      },
    };
    const chunks: string[] = [];
    const app = createChatServer({
      requestTraceStore: failing,
      requestLogger: createRequestLogger((line) => chunks.push(line)),
      executeTurn: async () => ({
        conversationId: "88888888-8888-4888-8888-888888888888",
        answer: "nao grava",
        trace: [{ type: "answer", content: "segredo-do-turn", node: "react" }],
        metrics: { llmCalls: 1, latencyMs: 2 },
      }),
    });
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "falha" }),
    });
    const body = (await response.json()) as {
      requestId: string;
      error: { code: string; message: string };
    };
    assert.equal(response.status, 500);
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.equal(body.error.message, "Não foi possível gravar o trace do pedido.");
    assert.equal(body.error.message.includes("SQLITE"), false);
    assert.equal(body.error.message.includes("secret"), false);
    assert.equal(response.headers.get("x-request-id"), body.requestId);
    assert.equal(failing.findById(body.requestId), null);
    const parsed = chunks.map((line) => JSON.parse(line) as { kind: string });
    assert.deepEqual(parsed.map((line) => line.kind), ["request"]);
    assert.equal(chunks.join("").includes("segredo-do-turn"), false);

    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
});

describe("GET /requests/:id", () => {
  const ops = new SqliteOpsStore(":memory:");
  const requestTraceStore = new SqliteRequestTraceStore(ops.db);
  const app = createChatServer({
    timeoutMs: 20,
    strategies: {
      react: immediateStrategy,
      planExecute: idleStrategy("planGet"),
      reflect: idleStrategy("reflect"),
      team: idleStrategy("team"),
    },
    routeModel: reactRouter(),
    conversationStore: new MemoryConversationStore(),
    baseTools: [],
    learning: {
      distill: async () => ({ hasLearning: false, fact: "" }),
    },
    requestTraceStore,
    requestLogger: createRequestLogger(() => undefined),
  });
  const server = createServer(app);
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("devolve o registro e o trace do 200, e 404 não insere", async () => {
    const created = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "consultar" }),
    });
    const chat = (await created.json()) as {
      requestId: string;
      conversationId: string;
      metrics: unknown;
      trace: unknown[];
    };
    assert.equal(created.status, 200);

    const first = await fetch(`${baseUrl}/requests/${chat.requestId}`);
    const record = (await first.json()) as {
      requestId: string;
      conversationId: string;
      createdAt: string;
      metrics: unknown;
      trace: unknown[];
    };
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("x-request-id"), null);
    assert.equal(record.requestId, chat.requestId);
    assert.equal(record.conversationId, chat.conversationId);
    assert.match(record.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(record.metrics, chat.metrics);
    assert.deepEqual(record.trace, chat.trace);

    const second = await fetch(`${baseUrl}/requests/${chat.requestId}`);
    assert.deepEqual(await second.json(), record);

    const before = (ops.db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number }).n;
    const missingId = "99999999-9999-4999-8999-999999999999";
    const missing = await fetch(`${baseUrl}/requests/${missingId}`);
    const missingBody = (await missing.json()) as { error: { code: string; message: string } };
    assert.equal(missing.status, 404);
    assert.equal(missingBody.error.code, "NOT_FOUND");
    assert.equal((ops.db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number }).n, before);

    const rejected = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    const rejectedBody = (await rejected.json()) as { requestId: string };
    const absent = await fetch(`${baseUrl}/requests/${rejectedBody.requestId}`);
    assert.equal(absent.status, 404);
    assert.equal((ops.db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number }).n, before);
  });

  it("id inválido é 400", async () => {
    const bad = await fetch(`${baseUrl}/requests/nao-e-uuid`);
    const body = (await bad.json()) as { issues: unknown[] };
    assert.equal(bad.status, 400);
    assert.ok(body.issues.length > 0);

    const blank = await fetch(`${baseUrl}/requests/${encodeURIComponent("   ")}`);
    assert.equal(blank.status, 400);
  });
});

describe("GET /stats", () => {
  const ops = new SqliteOpsStore(":memory:");
  const requestTraceStore = new SqliteRequestTraceStore(ops.db);
  const app = createChatServer({
    requestTraceStore,
    requestLogger: createRequestLogger(() => undefined),
    executeTurn: async (input) => {
      if (input.conversationId === "00000000-0000-0000-0000-000000000000") {
        throw new NotFoundError(`Conversa não encontrada: "${input.conversationId}"`);
      }
      return {
        conversationId: "12121212-1212-4121-8121-121212121212",
        answer: "ok",
        trace: [
          {
            type: "route",
            route: "react",
            reason: "curta",
            override: false,
            node: "roteador",
          },
        ],
        metrics: { llmCalls: 1, latencyMs: 80, promptTokens: 12, fallbacks: 0 },
      };
    },
  });
  const server = createServer(app);
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("since=24h agrega o pedido e rejeita duração inválida", async () => {
    const posted = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "stats" }),
    });
    assert.equal(posted.status, 200);

    const missing = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "sumiu",
        conversationId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    assert.equal(missing.status, 404);

    const stats = await fetch(`${baseUrl}/stats?since=24h`);
    const body = (await stats.json()) as {
      since: string;
      total: number;
      errors: number;
      tokens: number;
      cost: number;
      latencyMs: { p50: number; p95: number };
      byRoute: Array<{ route: string; total: number }>;
      byModel: Array<{ model: string; cost: number }>;
    };
    assert.equal(stats.status, 200);
    assert.equal(body.since, "24h");
    assert.equal(body.total, 2);
    assert.equal(body.errors, 1);
    assert.equal(body.tokens, 12);
    assert.equal(body.cost, 0);
    assert.deepEqual(body.latencyMs, { p50: 0, p95: 80 });
    assert.equal(body.byRoute.find((item) => item.route === "react")?.total, 1);
    assert.ok(body.byModel.every((item) => item.cost === 0));

    const bad = await fetch(`${baseUrl}/stats?since=ontem`);
    const issues = (await bad.json()) as { issues: unknown[] };
    assert.equal(bad.status, 400);
    assert.ok(issues.issues.length > 0);
  });
});

describe("POST /chat decisão e CORS", () => {
  const conversationStore = new MemoryConversationStore();
  const ops = new SqliteOpsStore(":memory:");
  const requestTraceStore = new SqliteRequestTraceStore(ops.db);
  let runs = 0;
  const app = createChatServer({
    conversationStore,
    requestTraceStore,
    executeTurn: async (input) => {
      runs += 1;
      const conversationId = input.conversationId ?? conversationStore.create();
      return {
        conversationId,
        answer: "ok",
        trace: [{ type: "answer", content: "ok" }],
        metrics: { llmCalls: 0, latencyMs: 1 },
      };
    },
  });
  const server = createServer(app);
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  async function post(body: unknown, origin?: string): Promise<Response> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (origin) {
      headers.origin = origin;
    }
    return fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  it("aceita approve e deny sem chamar a estratégia e grava o trace", async () => {
    const opened = await post({ message: "abrir conversa" });
    const openedBody = await opened.json() as { conversationId: string };
    assert.equal(opened.status, 200);
    assert.equal(runs, 1);

    const approved = await post({
      conversationId: openedBody.conversationId,
      decision: "approve",
    });
    const approvedBody = await approved.json() as {
      requestId: string;
      conversationId: string;
      answer: string;
      trace: Array<{ type: string; content: string; node: string }>;
      metrics: { llmCalls: number; latencyMs: number };
    };
    assert.equal(approved.status, 200);
    assert.equal(approved.headers.get("x-request-id"), approvedBody.requestId);
    assert.equal(approvedBody.answer, "Aprovado.");
    assert.equal(approvedBody.conversationId, openedBody.conversationId);
    assert.deepEqual(approvedBody.trace, [{
      type: "answer",
      content: "Aprovado.",
      node: "decisao",
    }]);
    assert.deepEqual(approvedBody.metrics, { llmCalls: 0, latencyMs: 0 });
    assert.equal(runs, 1);
    assert.deepEqual(requestTraceStore.findById(approvedBody.requestId)?.trace, approvedBody.trace);
    const stored = conversationStore.lastMessages(openedBody.conversationId, 10);
    assert.equal(stored.at(-2)?.content, "Aprovar");
    assert.equal(stored.at(-1)?.content, "Aprovado.");

    const denied = await post({
      conversationId: openedBody.conversationId,
      decision: "deny",
    });
    const deniedBody = await denied.json() as { answer: string };
    assert.equal(denied.status, 200);
    assert.equal(deniedBody.answer, "Negado.");
    assert.equal(runs, 1);
  });

  it("rejeita decisão inválida e conversa inexistente sem gravar", async () => {
    const runsBefore = runs;
    for (const body of [
      { conversationId: "algum", decision: "maybe" },
      { decision: "approve" },
      { message: "oi", decision: "approve", conversationId: "algum" },
    ]) {
      const response = await post(body);
      const payload = await response.json() as { issues: unknown[] };
      assert.equal(response.status, 400);
      assert.ok(payload.issues.length > 0);
    }

    const missing = await post({
      conversationId: "00000000-0000-4000-8000-000000000000",
      decision: "approve",
    });
    const missingBody = await missing.json() as { requestId: string; error: { code: string } };
    assert.equal(missing.status, 404);
    assert.equal(missingBody.error.code, "NOT_FOUND");
    assert.equal(requestTraceStore.findById(missingBody.requestId), null);
    assert.equal(runs, runsBefore);
  });

  it("libera CORS só quando a requisição traz Origin", async () => {
    const preflight = await fetch(`${baseUrl}/chat`, {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(preflight.headers.get("vary"), "Origin");
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /POST/);
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /Content-Type/);
    assert.equal(preflight.headers.get("access-control-allow-credentials"), null);
    assert.equal(preflight.headers.get("x-request-id"), null);

    const posted = await post({ message: "cors" }, "http://localhost:5173");
    assert.equal(posted.status, 200);
    assert.equal(posted.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(posted.headers.get("vary"), "Origin");
    const postedBody = await posted.json() as { answer: string };
    assert.equal(postedBody.answer, "ok");

    const plain = await post({ message: "sem origem" });
    assert.equal(plain.status, 200);
    assert.equal(plain.headers.get("access-control-allow-origin"), null);
  });
});
