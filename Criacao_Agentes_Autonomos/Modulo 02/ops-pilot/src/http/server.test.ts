import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { createChatServer } from "./server.js";
import type { StrategyRegistry } from "../agents/index.js";
import type { ReasoningStrategy } from "../agents/types.js";

const immediateStrategy: ReasoningStrategy = {
  name: "fake",
  async run(input) {
    return {
      answer: `Resposta para: ${input}`,
      trace: [{ type: "answer", content: `Resposta para: ${input}` }],
      metrics: { llmCalls: 0, latencyMs: 1 },
    };
  },
};

function createRegistry(strategies: Record<string, ReasoningStrategy>): StrategyRegistry & {
  calls: Array<{ name: string; reflect: boolean }>;
} {
  const calls: Array<{ name: string; reflect: boolean }> = [];
  return {
    calls,
    resolve(name, reflect) {
      calls.push({ name, reflect });
      return strategies[name];
    },
    names() {
      return Object.keys(strategies);
    },
  };
}

describe("POST /chat", () => {
  const registry = createRegistry({ react: immediateStrategy, custom: immediateStrategy });
  const app = createChatServer({ registry, timeoutMs: 20 });
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

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      answer: "Resposta para: status",
      trace: [{ type: "answer", content: "Resposta para: status" }],
      metrics: { llmCalls: 0, latencyMs: 1 },
    });
    assert.deepEqual(registry.calls.at(-1), { name: "react", reflect: false });
  });

  it("resolve estratégia explícita e encaminha reflect", async () => {
    const response = await post({ message: "revisar", strategy: "custom", reflect: true });

    assert.equal(response.status, 200);
    assert.deepEqual(registry.calls.at(-1), { name: "custom", reflect: true });
  });

  it("encaminha reflect: false sem aplicar reflexão", async () => {
    const response = await post({ message: "status", strategy: "custom", reflect: false });

    assert.equal(response.status, 200);
    assert.deepEqual(registry.calls.at(-1), { name: "custom", reflect: false });
  });

  it("retorna 400 com issues Zod para body inválido", async () => {
    const response = await post({ message: "", reflect: "true" });
    const body = await response.json() as { issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
  });

  it("retorna 400 com issues para JSON malformado", async () => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const body = await response.json() as { issues: unknown[] };

    assert.equal(response.status, 400);
    assert.ok(body.issues.length > 0);
  });

  it("retorna 422 para estratégia desconhecida", async () => {
    const response = await post({ message: "status", strategy: "missing" });

    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      error: {
        code: "UNKNOWN_STRATEGY",
        message: 'Estratégia desconhecida: "missing".',
      },
    });
  });

  it("retorna 504 quando a estratégia excede o timeout", async () => {
    const slowRegistry = createRegistry({
      react: {
        name: "slow",
        async run() {
          return new Promise(() => undefined);
        },
      },
    });
    const timeoutServer = createServer(createChatServer({ registry: slowRegistry, timeoutMs: 1 }));
    await new Promise<void>((resolve) => timeoutServer.listen(0, "127.0.0.1", resolve));
    const address = timeoutServer.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "status" }),
    });

    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), {
      error: {
        code: "CHAT_TIMEOUT",
        message: "A execução excedeu o limite de 1 ms.",
      },
    });
    await new Promise<void>((resolve, reject) => timeoutServer.close((error) => error ? reject(error) : resolve()));
  });
});
