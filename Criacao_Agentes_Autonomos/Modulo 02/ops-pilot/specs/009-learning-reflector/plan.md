# Implementation Plan: Refletor de aprendizado

**Branch**: `009-learning-reflector` | **Date**: 2026-09-18 | **Spec**: [spec.md](spec.md)

## Summary

Após cada turn de chat **bem-sucedido** com `userId`, destilar a mensagem do usuário via `withStructuredOutput({ hasLearning, fact })` e, se houver fato durável, chamar `MemoryStore.remember` em fire-and-forget (sem atrasar o `200`). Expor tool `forget_preference` (recall → forget no escopo do `userId`) injetada nas estratégias quando memória estiver disponível. Depende de `008-semantic-memory`.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: Express, Zod, LangChain (`withStructuredOutput` / `tool`), `MemoryStore` (008), OpenRouter via `createModel` (refletor); testes com fakes sem rede

**Storage**: Reusa tabela `memories` / `MemoryStore` (008); sem DDL novo

**Testing**: `node:test` + `tsx`; refletor com modelo fake estruturado; `runChat`/HTTP com MemoryStore fake; tool unitária; assert de não-bloqueio do `remember`

**Target Platform**: Serviço HTTP OpsPilot (mesmo processo)

**Project Type**: Backend / web-service (extensão de 007/008)

**Performance Goals**: Caminho crítico do `/chat` não aguarda embedding/`remember` do aprendizado

**Constraints**: MVC; Zod na fronteira; erros de domínio; aprendizado best-effort (falha não quebra `200`); nunca persistir pontual/segredo; prepared statements já no store

**Scale/Scope**: 1 serviço refletor + gancho em `runChat` + 1 tool; sem UI, sem auth forte, sem refletor em CLI/arena

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: destilação / filtro de fato = serviço; IO no `MemoryStore`; HTTP/`runChat` só orquestra e dispara fire-and-forget.
- [x] **II. Validação na fronteira**: schema Zod `{ hasLearning, fact }` e args da tool `forget_preference`.
- [x] **III. Erros de domínio**: tool sem `userId` → erro de domínio serializado; falhas do refletor engolidas no gancho async.
- [x] **IV. Teste é parte da tarefa**: preferência / pontual / segredo / forget / não-bloqueio; typecheck/test verdes.
- [x] **V. Segurança por padrão**: prompt + pós-filtro contra segredos; sem dotenv novo.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência**: reusa SQLite/`MemoryStore` 008; testes `:memory:` / fake.

## Project Structure

### Documentation (this feature)

```text
specs/009-learning-reflector/
├── checklists/requirements.md
├── contracts/forget-preference-tool.md
├── contracts/learning-reflector.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── learning-reflector.ts       # NOVO: schema, prompt, distillLearning, scheduleRemember
│   ├── learning-reflector.test.ts  # NOVO: fakes structured output
│   ├── run-chat.ts                 # gancho pós-sucesso + injeta tools de memória
│   └── run-chat.test.ts            # remember async / skip sem userId
├── agents/
│   ├── memory-tools.ts             # NOVO (ou em tools.ts): forget_preference
│   ├── memory-tools.test.ts
│   ├── tools.ts                    # opcional: factory helpers
│   ├── react.ts / plan-and-execute.ts  # já aceitam options.tools
│   └── types.ts                    # Metrics opcional learningAttempted? (só se útil)
├── http/
│   └── server.test.ts              # regressão + aprendizado com fake (se coberto via runChat)
└── memory-store.ts                 # reuso (sem mudança de contrato)
```

**Structure Decision**: Projeto único. Refletor em `src/services/learning-reflector.ts` (espelha `provider-status` / composição). Gancho em `runChat` (único ponto pós-estratégia). Tool em módulo dedicado, criada por turn com `{ memory, userId }` e passada em `strategy.run(..., { tools })` mesclada às ops tools.

## Phase 0: Research

Decisões em [research.md](research.md): fire-and-forget em `runChat`; schema Zod; pós-filtro de segredos; `forget_preference` via recall top-1; injeção de tools por turn.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/learning-reflector.md](contracts/learning-reflector.md), [contracts/forget-preference-tool.md](contracts/forget-preference-tool.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Schema Zod + prompt + `distillLearning` + `maybeRememberAsync` em `learning-reflector.ts` (injetar `invokeStructured` / model fake).
2. Pós-filtro: rejeitar `fact` vazio, segredo heurístico, `hasLearning=false`.
3. Gancho em `runChat`: se `userId` + `memory` + learner → `void maybeRememberAsync(...).catch(...)` após sucesso, sem await.
4. `createForgetPreferenceTool({ memory, userId })`; em `runChat`, montar `tools = [...opsDefaults?, forget]` e passar a `strategy.run(input, { tools })` (garantir que ReAct/PnE usam `options.tools` quando fornecidos — já o fazem).
5. Testes refletor + runChat + tool; typecheck/test verdes.

## Complexity Tracking

Nenhuma violação constitucional. Nota: LLM do refletor em produção usa OpenRouter (mesmo `createModel`); testes **obrigam** fake injetável para não depender de rede.
