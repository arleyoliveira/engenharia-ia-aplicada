import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TraceEvent } from "../agents/types.js";
import { SqliteRequestTraceStore } from "./request-trace-store.js";
import { SqliteOpsStore } from "./sqlite-ops-store.js";

const metrics = {
  llmCalls: 2,
  latencyMs: 15,
  promptTokens: 8,
  fallbacks: 0,
};

function openStore(): { ops: SqliteOpsStore; store: SqliteRequestTraceStore } {
  const ops = new SqliteOpsStore(":memory:");
  return { ops, store: new SqliteRequestTraceStore(ops.db) };
}

function countRequests(ops: SqliteOpsStore): number {
  const row = ops.db.prepare("SELECT COUNT(*) AS n FROM requests").get() as { n: number };
  return row.n;
}

describe("SqliteRequestTraceStore", () => {
  it("grava métricas e eventos na ordem, com node e payload", () => {
    const { ops, store } = openStore();
    const trace: TraceEvent[] = [
      { type: "thought", content: "pensar", node: "react" },
      { type: "answer", content: "pronto" },
    ];

    store.save({
      requestId: "11111111-1111-4111-8111-111111111111",
      conversationId: "22222222-2222-4222-8222-222222222222",
      metrics,
      trace,
    });

    const rows = ops.db
      .prepare(
        `SELECT position, node, payload_json AS payloadJson
         FROM trace_events WHERE request_id = ? ORDER BY position ASC`,
      )
      .all("11111111-1111-4111-8111-111111111111") as Array<{
      position: number;
      node: string;
      payloadJson: string;
    }>;

    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.position, 0);
    assert.equal(rows[0]?.node, "react");
    assert.deepEqual(JSON.parse(rows[0]?.payloadJson ?? ""), trace[0]);
    assert.equal(rows[1]?.position, 1);
    assert.equal(rows[1]?.node, "");
    assert.deepEqual(JSON.parse(rows[1]?.payloadJson ?? ""), trace[1]);

    const found = store.findById("11111111-1111-4111-8111-111111111111");
    assert.ok(found);
    assert.equal(found.conversationId, "22222222-2222-4222-8222-222222222222");
    assert.match(found.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(found.metrics, metrics);
    assert.deepEqual(found.trace, trace);
  });

  it("trace vazio grava o pedido e zero eventos", () => {
    const { ops, store } = openStore();
    store.save({
      requestId: "33333333-3333-4333-8333-333333333333",
      conversationId: "conv",
      metrics,
      trace: [],
    });

    const events = ops.db
      .prepare("SELECT COUNT(*) AS n FROM trace_events WHERE request_id = ?")
      .get("33333333-3333-4333-8333-333333333333") as { n: number };
    assert.equal(events.n, 0);
    assert.deepEqual(store.findById("33333333-3333-4333-8333-333333333333")?.trace, []);
  });

  it("payload circular não deixa pedido pela metade", () => {
    const { ops, store } = openStore();
    const event = {
      type: "thought" as const,
      content: "loop",
      node: "react",
      self: undefined as unknown,
    };
    event.self = event;

    assert.throws(() => {
      store.save({
        requestId: "44444444-4444-4444-8444-444444444444",
        conversationId: "conv",
        metrics,
        trace: [event as TraceEvent],
      });
    });
    assert.equal(countRequests(ops), 0);
    assert.equal(store.findById("44444444-4444-4444-8444-444444444444"), null);
  });

  it("segundo save com o mesmo id não apaga o primeiro", () => {
    const { store } = openStore();
    const requestId = "55555555-5555-4555-8555-555555555555";
    store.save({
      requestId,
      conversationId: "primeira",
      metrics,
      trace: [{ type: "answer", content: "ok", node: "resposta" }],
    });

    assert.throws(() => {
      store.save({
        requestId,
        conversationId: "segunda",
        metrics,
        trace: [],
      });
    });

    assert.equal(store.findById(requestId)?.conversationId, "primeira");
    assert.equal(store.findById(requestId)?.trace.length, 1);
  });

  it("stats ?since=24h ignora pedido antigo e separa rota, modelo e erro", () => {
    const { store } = openStore();
    const now = new Date("2026-09-24T12:00:00.000Z");
    const old = new Date(now.getTime() - 48 * 3_600_000).toISOString();
    const recent = new Date(now.getTime() - 60_000).toISOString();

    store.save({
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      conversationId: "conv",
      metrics: { llmCalls: 1, latencyMs: 100, promptTokens: 10 },
      trace: [],
      route: "react",
      model: "openai/gpt-4o-mini:free",
      status: "ok",
      createdAt: recent,
    });
    store.save({
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      conversationId: "conv",
      metrics: { llmCalls: 0, latencyMs: 900, promptTokens: 0 },
      trace: [],
      route: "react",
      model: "openai/gpt-4o-mini:free",
      status: "error",
      createdAt: recent,
    });
    store.save({
      requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      conversationId: "conv",
      metrics: { llmCalls: 1, latencyMs: 50, promptTokens: 99 },
      trace: [],
      route: "planExecute",
      model: "outro",
      status: "ok",
      createdAt: old,
    });

    const report = store.stats("24h", 24 * 3_600_000, now);
    assert.equal(report.total, 2);
    assert.equal(report.errors, 1);
    assert.equal(report.tokens, 10);
    assert.equal(report.cost, 0);
    assert.deepEqual(report.latencyMs, { p50: 100, p95: 900 });
    assert.equal(report.byRoute.length, 1);
    assert.equal(report.byRoute[0]?.route, "react");
    assert.equal(report.byModel[0]?.model, "openai/gpt-4o-mini:free");
    assert.equal(report.byModel[0]?.cost, 0);
  });

  it("stats lê métricas e rota quando as colunas novas ficaram no padrão", () => {
    const { ops, store } = openStore();
    const now = new Date("2026-09-24T15:00:00.000Z");
    const id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    ops.db
      .prepare(
        "INSERT INTO requests (id, conversation_id, created_at, metrics_json) VALUES (?, ?, ?, ?)",
      )
      .run(
        id,
        "conv",
        now.toISOString(),
        JSON.stringify({
          llmCalls: 3,
          latencyMs: 22196,
          promptTokens: 5237,
          fallbacks: 0,
        }),
      );
    ops.db
      .prepare(
        "INSERT INTO trace_events (request_id, position, node, payload_json) VALUES (?, ?, ?, ?)",
      )
      .run(
        id,
        0,
        "roteador",
        JSON.stringify({
          type: "route",
          route: "react",
          reason: "consulta",
          override: false,
          node: "roteador",
        }),
      );

    const previous = process.env.OPENROUTER_MODEL;
    process.env.OPENROUTER_MODEL = "nex-agi/nex-n2.5-mini:free";
    try {
      const report = store.stats("24h", 24 * 3_600_000, now);
      assert.equal(report.total, 1);
      assert.equal(report.tokens, 5237);
      assert.deepEqual(report.latencyMs, { p50: 22196, p95: 22196 });
      assert.equal(report.cost, 0);
      assert.equal(report.byRoute[0]?.route, "react");
      assert.equal(report.byModel[0]?.model, "nex-agi/nex-n2.5-mini:free");
    } finally {
      if (previous === undefined) {
        delete process.env.OPENROUTER_MODEL;
      } else {
        process.env.OPENROUTER_MODEL = previous;
      }
    }
  });

  it("findById devolve null quando o id não existe", () => {
    const { store } = openStore();
    assert.equal(store.findById("66666666-6666-4666-8666-666666666666"), null);
  });
});
