/**
 * Fábrica única do modelo LLM (OpenRouter via ChatOpenAI).
 * Lê OPENROUTER_API_KEY e OPENROUTER_MODEL do ambiente (sem dotenv —
 * carregue com `--env-file` nativo do Node). Temperatura 0 (determinismo).
 */
import { ChatOpenAI } from "@langchain/openai";
import { ConfigError } from "../errors.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new ConfigError(
      `Variável de ambiente ${name} ausente. Defina no ambiente ou em .env.`,
    );
  }
  return value;
}

export function createModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: requireEnv("OPENROUTER_MODEL"),
    apiKey: requireEnv("OPENROUTER_API_KEY"),
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
    temperature: 0,
  });
}
