# Data Model: Refletor de aprendizado

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## Entidades

### LearningReflection

```text
LearningReflection = {
  hasLearning: boolean
  fact: string           // pode ser "" se hasLearning=false
}
```

Validação Zod na fronteira do refletor. Persistência só se `hasLearning && fact.trim()`.

### DurableFact

```text
DurableFact = string  // 1 frase; preferência/restrição estável; sem segredo
```

Não é tabela nova — vira argumento de `MemoryStore.remember(userId, fact)`.

### ForgetPreferenceArgs

```text
ForgetPreferenceArgs = {
  preference: string     // descrição em linguagem natural da preferência a esquecer
}
```

### ForgetPreferenceResult

```text
ForgetPreferenceResult =
  | { forgotten: true; id: string; fact: string }
  | { forgotten: false; reason: "not_found" | "no_user" | "no_store" }
```

## Persistência

Nenhuma tabela nova. Reusa `memories` (008):

| Coluna | Uso nesta feature |
|--------|-------------------|
| `user_id` | escopo do aprendizado e da tool |
| `fact` | fato destilado pelo refletor |
| `embedding` | gerado em `remember` (async) |

## Fluxos

### Aprendizado pós-turn

```text
runChat sucesso + userId + memory
  → distillLearning(userMessage) → LearningReflection
  → pós-filtro (vazio / segredo / !hasLearning) → stop
  → schedule: memory.remember(userId, fact)   // sem await no caminho crítico
  → return ChatOutput
```

### forget_preference

```text
tool(preference)
  → recall(userId, preference)
  → sem hits → { forgotten: false, reason: "not_found" }
  → forget(userId, top.id) → { forgotten: true, id, fact }
```

## Relacionamentos

```text
ChatTurn --triggers--> LearningReflection --async--> Memory (008)
ForgetPreferenceTool --uses--> MemoryStore.recall + forget
```
