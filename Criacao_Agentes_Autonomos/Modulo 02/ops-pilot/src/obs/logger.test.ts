import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequestLogger } from "./logger.js";

const TRACE_KEYS = ["ts", "level", "kind", "requestId", "seq", "type", "node"];
const SECRET = "NAO-PODE-VAZAR-XYZ";

function linesOf(chunks: string[]): unknown[] {
  return chunks.map((chunk) => {
    assert.equal(chunk.endsWith("\n"), true);
    assert.equal(chunk.trim().includes("\n"), false);
    return JSON.parse(chunk) as unknown;
  });
}

describe("createRequestLogger", () => {
  it("escreve uma linha de metadados por evento, sem payload", () => {
    const chunks: string[] = [];
    const logger = createRequestLogger((line) => chunks.push(line));
    const payload = { content: SECRET, args: { segredo: SECRET }, steps: [SECRET] };

    logger.traceEvent({
      requestId: "req-1",
      seq: 0,
      type: "thought",
      node: "react",
    });
    logger.traceEvent({
      requestId: "req-1",
      seq: 1,
      type: "answer",
      node: "",
    });
    logger.request({
      requestId: "req-1",
      status: 200,
      metrics: { llmCalls: 1, latencyMs: 4, promptTokens: 3 },
    });

    const parsed = linesOf(chunks);
    assert.equal(parsed.length, 3);
    assert.deepEqual(Object.keys(parsed[0] as object), TRACE_KEYS);
    assert.deepEqual(parsed[0], {
      ts: (parsed[0] as { ts: string }).ts,
      level: "info",
      kind: "trace",
      requestId: "req-1",
      seq: 0,
      type: "thought",
      node: "react",
    });
    assert.equal((parsed[1] as { seq: number }).seq, 1);
    assert.equal((parsed[1] as { node: string }).node, "");
    assert.equal((parsed[2] as { kind: string }).kind, "request");
    assert.equal((parsed[2] as { status: number }).status, 200);
    assert.deepEqual((parsed[2] as { metrics: unknown }).metrics, {
      llmCalls: 1,
      latencyMs: 4,
      promptTokens: 3,
    });
    assert.equal(Object.hasOwn(parsed[2] as object, "content"), false);
    assert.equal(chunks.join("").includes(SECRET), false);
    assert.equal(chunks.join("").includes(JSON.stringify(payload)), false);
    assert.match((parsed[0] as { ts: string }).ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("resumo de erro não leva metrics e trace vazio não gera linha de evento", () => {
    const chunks: string[] = [];
    const logger = createRequestLogger((line) => chunks.push(line));
    logger.request({ requestId: "req-2", status: 400 });

    const parsed = linesOf(chunks);
    assert.equal(parsed.length, 1);
    assert.equal((parsed[0] as { kind: string }).kind, "request");
    assert.equal((parsed[0] as { status: number }).status, 400);
    assert.equal(Object.hasOwn(parsed[0] as object, "metrics"), false);
  });
});