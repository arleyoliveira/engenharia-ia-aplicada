/**
 * Refletor de aprendizado: destila fatos duráveis da mensagem do usuário
 * e agenda MemoryStore.remember de forma assíncrona (fire-and-forget).
 */
import { z } from "zod";
import { createModel } from "../agents/model.js";
import type { MemoryStore } from "../memory-store.js";

export const learningReflectionSchema = z.object({
  hasLearning: z.boolean(),
  fact: z.string(),
});

export type LearningReflection = z.infer<typeof learningReflectionSchema>;

export const LEARNING_REFLECTOR_PROMPT = `Você é o refletor de aprendizado do OpsPilot.
Analise APENAS a mensagem do plantonista e decida se há um fato DURÁVEL a memorizar.

Regras:
1. hasLearning=true somente para preferências ou restrições estáveis (idioma, canal, severidade preferida, horário de plantão, etc.).
2. Pedidos pontuais/efêmeros ("liste alertas agora", "abra incidente X") → hasLearning=false e fact="".
3. Segredos (senhas, tokens, API keys, credenciais) → hasLearning=false e fact="". NUNCA grave segredos.
4. Se hasLearning=true, fact deve ser UMA frase curta, sem credenciais, reformulando a preferência.

Responda apenas no schema estruturado.`;

/** Padrões óbvios de segredo (defesa além do modelo). */
const SECRET_PATTERN =
  /(?:api[_-]?key|password|passwd|secret|token|bearer|sk-[a-zA-Z0-9]{10,}|-----BEGIN)/i;

export interface LearningReflectorDeps {
  /** Default: createModel().withStructuredOutput(...).invoke(...) */
  distill?: (userMessage: string) => Promise<LearningReflection>;
  /** Default: void fn().catch(() => undefined) — não bloqueia o caller */
  schedule?: (fn: () => Promise<void>) => void;
}

function defaultSchedule(fn: () => Promise<void>): void {
  void fn().catch(() => {
    // best-effort: falha do aprendizado não propaga
  });
}

async function defaultDistill(userMessage: string): Promise<LearningReflection> {
  const model = createModel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const structured = (model as any).withStructuredOutput(
    learningReflectionSchema,
    { method: "functionCalling" },
  );
  const raw = await structured.invoke([
    { role: "system", content: LEARNING_REFLECTOR_PROMPT },
    { role: "user", content: userMessage },
  ]);
  return learningReflectionSchema.parse(raw);
}

export function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERN.test(text);
}

/** Pós-filtro determinístico antes de persistir. */
export function shouldRemember(
  reflection: LearningReflection,
  userMessage: string,
): boolean {
  if (!reflection.hasLearning) {
    return false;
  }
  const fact = reflection.fact.trim();
  if (!fact) {
    return false;
  }
  if (looksLikeSecret(fact) || looksLikeSecret(userMessage)) {
    return false;
  }
  return true;
}

/** Destila a mensagem; não persiste. */
export async function distillLearning(
  userMessage: string,
  deps: LearningReflectorDeps = {},
): Promise<LearningReflection> {
  const distill = deps.distill ?? defaultDistill;
  return distill(userMessage);
}

/**
 * Se passar no pós-filtro, agenda memory.remember via schedule.
 * Erros de distill/remember são engolidos no caminho default.
 */
export function scheduleLearningRemember(
  input: { userId: string; userMessage: string },
  memory: MemoryStore,
  deps: LearningReflectorDeps = {},
): void {
  const schedule = deps.schedule ?? defaultSchedule;
  schedule(async () => {
    const reflection = await distillLearning(input.userMessage, deps);
    if (!shouldRemember(reflection, input.userMessage)) {
      return;
    }
    await memory.remember(input.userId, reflection.fact.trim());
  });
}
