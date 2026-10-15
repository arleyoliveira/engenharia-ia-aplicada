# Quickstart: Refletor de aprendizado

Validação: [contracts/learning-reflector.md](contracts/learning-reflector.md), [contracts/forget-preference-tool.md](contracts/forget-preference-tool.md). Modelo: [data-model.md](data-model.md). Depende de `008-semantic-memory`.

## Pré-requisitos

- `npm install` (já com `@huggingface/transformers` da 008).
- Testes desta feature usam **fakes** de distill/`MemoryStore` — sem OpenRouter.

## Cenário 1 - Destilação + remember (obrigatório)

```bash
npm run test -- src/services/learning-reflector.test.ts
npm run test -- src/services/run-chat.test.ts
```

**Esperado**:

- Preferência + `userId` → `remember` agendado/chamado com fact não vazio.
- Pedido pontual / segredo → sem `remember`.
- Sem `userId` → refletor omitido.
- Deferred `remember`: `runChat` resolve **antes** do settle do remember.

## Cenário 2 - Tool `forget_preference` (obrigatório)

```bash
npm run test -- src/agents/memory-tools.test.ts
```

**Esperado**:

- Fato seedado + `preference` semântica → `{ forgotten: true }`.
- Preferência inexistente → `{ forgotten: false, reason: "not_found" }`.

## Cenário 3 - Typecheck + suíte

```bash
npm run typecheck
npm run test
```

**Esperado**: verdes.

## Cenário 4 - Manual opcional

Com servidor real (`OPENROUTER_*` + `userId`):

```bash
npm run dev
curl -s localhost:3000/chat -H 'content-type: application/json' \
  -d '{"message":"prefiro alertas em português","userId":"ops-alice"}'
```

Turn seguinte com recall deve refletir o fato (após embedding async completar — aguardar ~1–2s).
