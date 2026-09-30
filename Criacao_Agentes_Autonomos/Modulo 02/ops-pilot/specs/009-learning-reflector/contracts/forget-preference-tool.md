# Contract: tool `forget_preference`

**Date**: 2026-09-18 | **Spec**: [spec.md](spec.md) | **Extends**: padrão de tools em `src/agents/tools.ts`

## Nome

`forget_preference`

## Descrição (normativa)

Remove uma preferência previamente memorizada do usuário atual. Use quando o plantonista pedir para esquecer/atualizar uma preferência (idioma, canal, severidade, etc.). Não use para apagar alertas/incidentes. Efeito: remove no máximo **uma** memória (melhor match semântico) no escopo do `userId` do turn. Retorna JSON com `forgotten` e detalhes.

## Schema

```typescript
z.object({
  preference: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Descrição em linguagem natural da preferência a esquecer (ex.: 'idioma das notificações').",
    ),
});
```

## Comportamento

1. Exige `userId` + `MemoryStore` injetados na factory (closure).
2. `hits = await memory.recall(userId, preference)`.
3. Se `hits.length === 0` → `JSON.stringify({ forgotten: false, reason: "not_found" })`.
4. Senão `ok = await memory.forget(userId, hits[0].id)` →  
   - sucesso: `{ forgotten: true, id, fact: hits[0].fact }`  
   - falha rara: `{ forgotten: false, reason: "not_found" }`
5. Erros de domínio → `failurePayload` (padrão ops tools).

## Factory

```typescript
export function createForgetPreferenceTool(deps: {
  memory: MemoryStore;
  userId: string;
}): StructuredTool;
```

## Wiring

Em `runChat`, quando `userId` e `memory` presentes:

```typescript
const forgetTool = createForgetPreferenceTool({ memory, userId });
const tools = [...baseOpsTools, forgetTool];
await strategy.run(turnInput, { tools });
```

Sem `userId`, a tool **não** é registrada naquele turn.
