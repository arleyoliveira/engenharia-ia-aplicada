# Contract: Learning Reflector

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md) | **Model**: [data-model.md](../data-model.md)

## Schema Zod

```typescript
export const learningReflectionSchema = z.object({
  hasLearning: z.boolean(),
  fact: z.string(),
});

export type LearningReflection = z.infer<typeof learningReflectionSchema>;
```

## API de serviço

```typescript
export interface LearningReflectorDeps {
  /** Default: createModel().withStructuredOutput(schema).invoke(...) */
  distill?: (userMessage: string) => Promise<LearningReflection>;
  /** Default: void fn().catch(log) */
  schedule?: (fn: () => Promise<void>) => void;
}

/** Destila a mensagem; não persiste. */
export function distillLearning(
  userMessage: string,
  deps?: LearningReflectorDeps,
): Promise<LearningReflection>;

/**
 * Se passar no pós-filtro, agenda memory.remember(userId, fact) via schedule.
 * Nunca lança para o caller síncrono do schedule default.
 */
export function scheduleLearningRemember(
  input: { userId: string; userMessage: string },
  memory: MemoryStore,
  deps?: LearningReflectorDeps,
): void;
```

## Regras de pós-filtro (antes do remember)

| Condição | Ação |
|----------|------|
| `hasLearning === false` | não agenda |
| `fact.trim()` vazio | não agenda |
| heurística de segredo em `fact` ou `userMessage` | não agenda |
| demais | `schedule(() => memory.remember(userId, fact.trim()))` |

## Prompt (resumo normativo)

- Só preferências/restrições **duráveis**.
- Pedidos pontuais (“liste alertas agora”) → `hasLearning=false`.
- Segredos (senhas, tokens, API keys) → `hasLearning=false`, `fact=""`.
- `fact` = uma frase curta, sem credenciais.

## Integração `runChat`

```typescript
// após strategy.run + append assistant, antes do return:
if (input.userId && deps.memory) {
  scheduleLearningRemember(
    { userId: input.userId, userMessage: input.message },
    deps.memory,
    deps.learning,
  );
}
```

Sem `await`. Sem alterar `ChatOutput` obrigatoriamente (métrica opcional fora de escopo).
