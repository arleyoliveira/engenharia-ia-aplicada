/**
 * Fábrica única do modelo LLM (OpenRouter via ChatOpenAI).
 * Primário e reserva: withRetry (2 tentativas) e withFallbacks([reserva]).
 * Env nativo do Node (sem dotenv). Temperatura 0.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { ConfigError, ModelUnavailableError } from "../errors.js";
import type { StrategyResult, TraceEvent } from "./types.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Tentativas de withRetry no primário e na reserva. */
export const MODEL_ATTEMPTS = 2;

export type FallbackEvent = Extract<TraceEvent, { type: "fallback" }>;

const fallbackStore = new AsyncLocalStorage<FallbackEvent[]>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigError(
      `Variável de ambiente ${name} ausente. Defina no ambiente ou em .env.`,
    );
  }
  return value.trim();
}

/** Ausente, vazio ou só espaços → sem identificador. */
export function readModelFallback(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = env.OPENROUTER_MODEL_FALLBACK;
  if (!value || value.trim() === "") {
    return undefined;
  }
  return value.trim();
}

export function baseModel(model: string): ChatOpenAI {
  return new ChatOpenAI({
    model,
    apiKey: requireEnv("OPENROUTER_API_KEY"),
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
    temperature: 0,
  });
}

function recordFallback(event: FallbackEvent): void {
  fallbackStore.getStore()?.push(event);
}

/** Testes e estratégias registram uma troca já acontecida no coletor ativo. */
export function noteFallback(from: string, to: string): void {
  recordFallback({ type: "fallback", from, to });
}

function watchFallback<I, O>(
  backup: Runnable<I, O>,
  from: string,
  to: string,
): Runnable<I, O> {
  return RunnableLambda.from(async (input, config) => {
    const output = await backup.invoke(input, config);
    recordFallback({ type: "fallback", from, to });
    return output;
  });
}

function guardUnavailable<I, O>(chain: Runnable<I, O>): Runnable<I, O> {
  return RunnableLambda.from(async (input, config) => {
    try {
      return await chain.invoke(input, config);
    } catch (error) {
      if (error instanceof ModelUnavailableError) {
        throw error;
      }
      throw new ModelUnavailableError();
    }
  });
}

function linkFallback<I, O>(
  primary: Runnable<I, O>,
  backup: Runnable<I, O>,
  from: string,
  to: string,
): Runnable<I, O> {
  return guardUnavailable(primary.withFallbacks([watchFallback(backup, from, to)]));
}

/**
 * Primário e reserva já com withRetry. A reserva só registra fallback se responder.
 * Esgotada a cadeia, lança ModelUnavailableError.
 */
export function createResilientRunnable<I, O>(options: {
  primary: Runnable<I, O>;
  backup: Runnable<I, O>;
  from?: string;
  to?: string;
}): Runnable<I, O> {
  const primary = options.primary.withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
  const backup = options.backup.withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
  return linkFallback(
    primary,
    backup,
    options.from ?? "primary",
    options.to ?? "backup",
  );
}

export async function collectFallbacks<T>(
  fn: () => Promise<T>,
): Promise<{ value: T; events: FallbackEvent[] }> {
  if (fallbackStore.getStore()) {
    return { value: await fn(), events: [] };
  }
  const events: FallbackEvent[] = [];
  const value = await fallbackStore.run(events, fn);
  return { value, events };
}

/** Abre coletor só se ninguém abriu. Eventos entram no trace da estratégia. */
export async function runCollectingFallbacks(
  run: () => Promise<StrategyResult>,
): Promise<StrategyResult> {
  if (fallbackStore.getStore()) {
    return run();
  }
  const { value, events } = await collectFallbacks(run);
  if (events.length === 0) {
    return {
      ...value,
      metrics: { ...value.metrics, fallbacks: 0 },
    };
  }
  return {
    ...value,
    trace: [...value.trace, ...events],
    metrics: { ...value.metrics, fallbacks: events.length },
  };
}

/**
 * Fachada: invoke usa a cadeia abaixo; bindTools e withStructuredOutput
 * repetem withRetry + withFallbacks em cada modelo já configurado.
 */
export class ResilientChat {
  constructor(
    private readonly primaryName: string,
    private readonly backupName: string,
    private readonly chain: Runnable<BaseLanguageModelInput, AIMessageChunk>,
  ) {}

  /** O ReAct pré-construído só chama bindTools em objetos com _modelType de chat model. */
  _modelType(): string {
    return "base_chat_model";
  }

  invoke(
    input: BaseLanguageModelInput,
    options?: Parameters<Runnable<BaseLanguageModelInput, AIMessageChunk>["invoke"]>[1],
  ): Promise<AIMessageChunk> {
    return this.chain.invoke(input, options);
  }

  bindTools(
    tools: Parameters<ChatOpenAI["bindTools"]>[0],
    kwargs?: Parameters<ChatOpenAI["bindTools"]>[1],
  ): Runnable<BaseLanguageModelInput, AIMessageChunk> {
    const primary = baseModel(this.primaryName)
      .bindTools(tools, kwargs)
      .withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
    const backup = baseModel(this.backupName)
      .bindTools(tools, kwargs)
      .withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
    return linkFallback(primary, backup, this.primaryName, this.backupName) as Runnable<
      BaseLanguageModelInput,
      AIMessageChunk
    >;
  }

  withStructuredOutput<RunOutput extends Record<string, unknown> = Record<string, unknown>>(
    schema: unknown,
    config?: unknown,
  ): Runnable<BaseLanguageModelInput, RunOutput> {
    const primary = baseModel(this.primaryName)
      .withStructuredOutput(schema as never, config as never)
      .withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
    const backup = baseModel(this.backupName)
      .withStructuredOutput(schema as never, config as never)
      .withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
    return linkFallback(
      primary,
      backup,
      this.primaryName,
      this.backupName,
    ) as Runnable<BaseLanguageModelInput, RunOutput>;
  }
}

export function createModel(): ResilientChat {
  const primaryName = requireEnv("OPENROUTER_MODEL");
  const backupName = requireEnv("OPENROUTER_MODEL_FALLBACK");
  const primary = baseModel(primaryName).withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
  const backup = baseModel(backupName).withRetry({ stopAfterAttempt: MODEL_ATTEMPTS });
  return new ResilientChat(
    primaryName,
    backupName,
    guardUnavailable(
      primary.withFallbacks([watchFallback(backup, primaryName, backupName)]),
    ) as Runnable<BaseLanguageModelInput, AIMessageChunk>,
  );
}
