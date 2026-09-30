import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RunnableLambda } from "@langchain/core/runnables";
import { ConfigError, ModelUnavailableError } from "../errors.js";
import {
  collectFallbacks,
  createModel,
  createResilientRunnable,
  MODEL_ATTEMPTS,
  readModelFallback,
  ResilientChat,
} from "./model.js";

function flaky(failures: number, label: string) {
  let calls = 0;
  const runnable = RunnableLambda.from(async () => {
    calls += 1;
    if (calls <= failures) {
      throw new Error(`${label} fail ${calls}`);
    }
    return `${label}-ok`;
  });
  return {
    runnable,
    get calls() {
      return calls;
    },
  };
}

describe("readModelFallback", () => {
  it("trata ausente, vazio e espaços como sem reserva", () => {
    assert.equal(readModelFallback({}), undefined);
    assert.equal(readModelFallback({ OPENROUTER_MODEL_FALLBACK: "" }), undefined);
    assert.equal(readModelFallback({ OPENROUTER_MODEL_FALLBACK: "  " }), undefined);
    assert.equal(
      readModelFallback({ OPENROUTER_MODEL_FALLBACK: "  openai/gpt-4o-mini  " }),
      "openai/gpt-4o-mini",
    );
  });
});

describe("createResilientRunnable", () => {
  it("recupera o primário na 2ª tentativa e não chama a reserva", async () => {
    const primary = flaky(1, "primary");
    const backup = flaky(0, "backup");
    const chain = createResilientRunnable({
      primary: primary.runnable,
      backup: backup.runnable,
      from: "primary-model",
      to: "backup-model",
    });

    const { value, events } = await collectFallbacks(() => chain.invoke("x"));

    assert.equal(value, "primary-ok");
    assert.equal(primary.calls, MODEL_ATTEMPTS);
    assert.equal(backup.calls, 0);
    assert.deepEqual(events, []);
  });

  it("chama a reserva só depois das 2 falhas do primário", async () => {
    const primary = flaky(9, "primary");
    const backup = flaky(0, "backup");
    const chain = createResilientRunnable({
      primary: primary.runnable,
      backup: backup.runnable,
      from: "primary-model",
      to: "backup-model",
    });

    const { value, events } = await collectFallbacks(() => chain.invoke("x"));

    assert.equal(value, "backup-ok");
    assert.equal(primary.calls, MODEL_ATTEMPTS);
    assert.equal(backup.calls, 1);
    assert.deepEqual(events, [
      { type: "fallback", from: "primary-model", to: "backup-model" },
    ]);
  });

  it("lança ModelUnavailableError se primário e reserva esgotam as 2 tentativas", async () => {
    const primary = flaky(9, "primary");
    const backup = flaky(9, "backup");
    const chain = createResilientRunnable({
      primary: primary.runnable,
      backup: backup.runnable,
    });

    await assert.rejects(
      () => chain.invoke("x"),
      (error: unknown) => error instanceof ModelUnavailableError,
    );
    assert.equal(primary.calls, MODEL_ATTEMPTS);
    assert.equal(backup.calls, MODEL_ATTEMPTS);
  });
});

describe("ResilientChat", () => {
  it("expõe _modelType e bindTools para o agente ReAct", () => {
    const chat = new ResilientChat(
      "primary",
      "backup",
      RunnableLambda.from(async () => "ok") as never,
    );
    assert.equal("_modelType" in chat, true);
    assert.equal(typeof chat._modelType, "function");
    assert.equal(chat._modelType(), "base_chat_model");
    assert.equal(typeof chat.bindTools, "function");
    assert.equal(typeof chat.invoke, "function");
  });
});

describe("createModel", () => {
  it("exige modelo primário, reserva e chave antes de abrir rede", () => {
    const previous = {
      model: process.env.OPENROUTER_MODEL,
      fallback: process.env.OPENROUTER_MODEL_FALLBACK,
      key: process.env.OPENROUTER_API_KEY,
    };
    delete process.env.OPENROUTER_MODEL;
    delete process.env.OPENROUTER_MODEL_FALLBACK;
    delete process.env.OPENROUTER_API_KEY;
    try {
      assert.throws(() => createModel(), ConfigError);
    } finally {
      if (previous.model === undefined) delete process.env.OPENROUTER_MODEL;
      else process.env.OPENROUTER_MODEL = previous.model;
      if (previous.fallback === undefined) delete process.env.OPENROUTER_MODEL_FALLBACK;
      else process.env.OPENROUTER_MODEL_FALLBACK = previous.fallback;
      if (previous.key === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = previous.key;
    }
  });
});
