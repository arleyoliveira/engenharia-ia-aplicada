/**
 * Testes determinísticos da camada de Reflection (sem rede).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  withReflection,
  extractObservations,
  critiqueSchema,
} from "./reflection.js";
import type {
  CritiqueResult,
  ReasoningStrategy,
  StrategyInput,
  StrategyResult,
  TraceEvent,
} from "./types.js";
import { composeChatPrompt } from "../services/compose-chat-prompt.js";

function createFakeStrategy(
  responses: Array<{
    answer: string;
    trace: TraceEvent[];
    llmCalls?: number;
    promptTokens?: number;
  }>,
): ReasoningStrategy & { inputsReceived: string[] } {
  const inputsReceived: string[] = [];
  let callIndex = 0;

  return {
    name: "fake-strategy",
    inputsReceived,
    async run(input: StrategyInput): Promise<StrategyResult> {
      inputsReceived.push(composeChatPrompt(input));
      const current = responses[callIndex] ?? responses[responses.length - 1]!;
      callIndex += 1;
      return {
        answer: current.answer,
        trace: current.trace,
        metrics: {
          llmCalls: current.llmCalls ?? 1,
          latencyMs: 10,
          promptTokens: current.promptTokens ?? 0,
        },
      };
    },
  };
}

function createFakeModel(
  verdicts: CritiqueResult[],
  options?: { criticPromptTokens?: number },
) {
  let index = 0;
  const criticPromptTokens = options?.criticPromptTokens;
  return {
    withStructuredOutput(_schema: unknown) {
      return {
        async invoke(
          _messages: unknown,
          invokeOptions?: {
            callbacks?: Array<{
              handleLLMStart?: () => void;
              handleLLMEnd?: (output: unknown) => void | Promise<void>;
            }>;
          },
        ) {
          const verdict = verdicts[index] ?? verdicts[verdicts.length - 1]!;
          index += 1;
          for (const cb of invokeOptions?.callbacks ?? []) {
            cb?.handleLLMStart?.();
            if (criticPromptTokens !== undefined) {
              await cb?.handleLLMEnd?.({
                llmOutput: {
                  tokenUsage: { promptTokens: criticPromptTokens },
                },
                generations: [],
              });
            }
          }
          return verdict;
        },
      };
    },
  };
}

describe("extractObservations", () => {
  it("extrai apenas eventos de observação do trace", () => {
    const trace: TraceEvent[] = [
      { type: "thought", content: "Pensando..." },
      { type: "action", tool: "list_alerts", args: {} },
      { type: "observation", content: '{"alerts":[{"id":1,"service":"billing"}]}' },
      { type: "action", tool: "open_incident", args: { service: "billing" } },
      { type: "observation", content: '{"incident":{"id":10}}' },
      { type: "answer", content: "Incidente aberto." },
    ];

    const obs = extractObservations(trace);
    assert.ok(obs.includes('{"alerts":[{"id":1,"service":"billing"}]}'));
    assert.ok(obs.includes('{"incident":{"id":10}}'));
    assert.ok(!obs.includes("Pensando..."));
  });

  it("retorna placeholder quando não houver observações", () => {
    const trace: TraceEvent[] = [
      { type: "thought", content: "Sem ferramentas" },
      { type: "answer", content: "Resposta direta." },
    ];
    assert.equal(extractObservations(trace), "(nenhuma observação)");
  });
});

describe("critiqueSchema", () => {
  it("valida objeto com approved e feedback", () => {
    const valid = critiqueSchema.parse({
      approved: true,
      feedback: "Resposta condizente.",
    });
    assert.equal(valid.approved, true);
    assert.equal(valid.feedback, "Resposta condizente.");
  });

  it("rejeita schema inválido", () => {
    assert.throws(() => critiqueSchema.parse({ approved: "sim" }));
  });
});

describe("withReflection", () => {
  it("aprova na primeira rodada sem regenerações", async () => {
    const fakeStrategy = createFakeStrategy([
      {
        answer: "Alerta de billing tratado.",
        trace: [
          { type: "action", tool: "list_alerts", args: {} },
          { type: "observation", content: '{"alerts":[{"service":"billing"}]}' },
          { type: "answer", content: "Alerta de billing tratado." },
        ],
        llmCalls: 2,
      },
    ]);

    const fakeModel = createFakeModel([
      { approved: true, feedback: "Factualmente correto." },
    ]);

    const reflected = withReflection(
      fakeStrategy,
      { maxReflections: 2 },
      { model: fakeModel as never },
    );

    assert.equal(reflected.name, "reflect:fake-strategy");
    const result = await reflected.run("Trate o alerta de billing");

    assert.equal(result.answer, "Alerta de billing tratado.");
    assert.equal(fakeStrategy.inputsReceived.length, 1);
    assert.equal(result.metrics.llmCalls, 3); // 2 da base + 1 do crítico

    const critiqueEvent = result.trace.find((e) => e.type === "critique");
    assert.ok(critiqueEvent);
    assert.equal(critiqueEvent.content, "[APROVADO] Factualmente correto.");
  });

  it("reprova na primeira rodada e corrige na segunda com injeção de feedback", async () => {
    const fakeStrategy = createFakeStrategy([
      {
        answer: "Abri incidente para checkout.", // Errado: o serviço é billing
        trace: [
          { type: "action", tool: "list_alerts", args: {} },
          { type: "observation", content: '{"alerts":[{"service":"billing"}]}' },
          { type: "answer", content: "Abri incidente para checkout." },
        ],
        llmCalls: 2,
      },
      {
        answer: "Abri incidente correto para billing.",
        trace: [
          { type: "action", tool: "open_incident", args: { service: "billing" } },
          { type: "observation", content: '{"incident":{"id":12}}' },
          { type: "answer", content: "Abri incidente correto para billing." },
        ],
        llmCalls: 2,
      },
    ]);

    const fakeModel = createFakeModel([
      { approved: false, feedback: "O serviço correto nas observações é billing, não checkout." },
      { approved: true, feedback: "Agora o serviço billing foi tratado corretamente." },
    ]);

    const reflected = withReflection(
      fakeStrategy,
      { maxReflections: 2 },
      { model: fakeModel as never },
    );

    const result = await reflected.run("Abra o incidente necessário");

    assert.equal(result.answer, "Abri incidente correto para billing.");
    assert.equal(fakeStrategy.inputsReceived.length, 2);
    assert.ok(fakeStrategy.inputsReceived[1]?.includes("O serviço correto nas observações é billing, não checkout."));

    // Métricas: 2 base + 1 critico + 2 base + 1 critico = 6
    assert.equal(result.metrics.llmCalls, 6);

    const critiques = result.trace.filter((e) => e.type === "critique");
    assert.equal(critiques.length, 2);
    assert.ok(critiques[0]?.content.startsWith("[REPROVADO]"));
    assert.ok(critiques[1]?.content.startsWith("[APROVADO]"));
  });

  it("interrompe no limite maxReflections quando não é aprovado", async () => {
    const fakeStrategy = createFakeStrategy([
      {
        answer: "Resposta insuficiente 1",
        trace: [{ type: "observation", content: "obs 1" }],
        llmCalls: 1,
      },
      {
        answer: "Resposta insuficiente 2",
        trace: [{ type: "observation", content: "obs 2" }],
        llmCalls: 1,
      },
    ]);

    const fakeModel = createFakeModel([
      { approved: false, feedback: "Ainda falta informação." },
      { approved: false, feedback: "Persiste o erro." },
    ]);

    const reflected = withReflection(
      fakeStrategy,
      { maxReflections: 2 },
      { model: fakeModel as never },
    );

    const result = await reflected.run("Pedido difícil");

    assert.equal(result.answer, "Resposta insuficiente 2");
    assert.equal(fakeStrategy.inputsReceived.length, 2);

    const critiques = result.trace.filter((e) => e.type === "critique");
    assert.equal(critiques.length, 3); // 2 reprovações + 1 aviso de limite atingido
    assert.ok(critiques[2]?.content.includes("[LIMITE ATINGIDO]"));
  });

  it("não invoca o crítico quando maxReflections é 0", async () => {
    const fakeStrategy = createFakeStrategy([
      {
        answer: "Resposta direta",
        trace: [{ type: "thought", content: "pensando" }],
        llmCalls: 1,
      },
    ]);

    const fakeModel = createFakeModel([]);

    const reflected = withReflection(
      fakeStrategy,
      { maxReflections: 0 },
      { model: fakeModel as never },
    );

    const result = await reflected.run("Pedido");
    assert.equal(result.answer, "Resposta direta");
    assert.equal(result.metrics.llmCalls, 1);
    assert.equal(result.trace.filter((e) => e.type === "critique").length, 0);
  });

  it("soma promptTokens das voltas da base e do crítico", async () => {
    const fakeStrategy = createFakeStrategy([
      {
        answer: "ok",
        trace: [
          { type: "observation", content: "obs" },
          { type: "answer", content: "ok" },
        ],
        llmCalls: 2,
        promptTokens: 100,
      },
    ]);

    const fakeModel = createFakeModel(
      [{ approved: true, feedback: "ok" }],
      { criticPromptTokens: 30 },
    );

    const reflected = withReflection(
      fakeStrategy,
      { maxReflections: 1 },
      { model: fakeModel as never },
    );

    const result = await reflected.run("pedido");
    assert.equal(result.metrics.promptTokens, 130);
  });
});
