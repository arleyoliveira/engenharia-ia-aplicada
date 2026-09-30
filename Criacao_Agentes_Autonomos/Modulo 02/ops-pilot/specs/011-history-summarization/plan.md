# Implementation Plan: Sumarização de histórico (pruning)

**Branch**: `011-history-summarization` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-history-summarization/spec.md`

## Summary

Plantões longos passam a usar janela crua de **8** mensagens. O que sai dessa janela é consolidado em lotes de **8** num resumo ~**150** tokens (decisões, fatos, pendências), **mesclado** ao resumo anterior e persistido em `conversation_summaries`. A consolidação **não** roda a cada request — só quando há lote elegível. O resumo entra no contexto do turn; o rastreio ganha evento `summarize` apenas nesses turns. Testes com sumarizador e store fake, sem rede.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: Express, Zod, LangChain/OpenRouter (sumarizador de produção); fakes nos testes

**Storage**: SQLite embarcado (`node:sqlite` / `DatabaseSync`), mesmo `OPSPILOT_DB`; nova tabela `conversation_summaries`; `:memory:` nos testes de store

**Testing**: `node:test` + `tsx`; `MemoryConversationStore` + sumarizador fake; `SqliteConversationStore` + `SqliteOpsStore(":memory:")`

**Target Platform**: Serviço HTTP OpsPilot (mesmo processo)

**Project Type**: Backend / web-service (extensão de 007/008/010)

**Performance Goals**: Turns sem lote elegível = zero chamada extra de modelo para sumarizar; consolidação no máximo a cada 8 mensagens podadas

**Constraints**: MVC; statements preparados; sem sumarizar a cada request; janela 8 substitui 12; falha de consolidação não mascara sucesso; sem segredos/dotenv

**Scale/Scope**: 1 tabela + extensão do ConversationStore + serviço de pruning + sumarizador (prod/fake) + composição de prompt + evento de trace + DI em `runChat`

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: elegibilidade/lote e formatação de prompt são funções puras (`src/services/` / `compose-chat-prompt`); IO no store e no sumarizador de produção; HTTP não conhece pruning.
- [x] **II. Validação na fronteira**: request Zod de `/chat` inalterado; entradas do sumarizador (lote + resumo anterior) tipadas; store valida conversa existente.
- [x] **III. Erros de domínio**: conversa inexistente continua `NotFoundError` → 404; falha ao sumarizar/persistir no turn elegível → erro de domínio/borda, sem 200 fingindo consolidação.
- [x] **IV. Teste é parte da tarefa**: fake + `:memory:`; janela 8; lote; mescla; sem re-sumarizar; evento `summarize`; typecheck/test verdes.
- [x] **V. Segurança por padrão**: sem segredo novo; prepared statements; sem SQL concatenado.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência embarcada**: DDL idempotente no mesmo `DatabaseSync`; testes de store em `:memory:`; fake para orquestração; `data/` ignorado.

## Project Structure

### Documentation (this feature)

```text
specs/011-history-summarization/
├── checklists/requirements.md
├── contracts/
│   ├── chat-http.md
│   ├── conversation-summary-store.md
│   └── history-summarizer.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── store/
│   ├── conversation-store.ts          # + getSummary / upsertSummary / messagesBefore
│   ├── sqlite-conversation-store.ts   # impl + usa DDL já no ops store
│   ├── sqlite-conversation-store.test.ts
│   ├── memory-conversation-store.ts   # fake com resumo
│   └── sqlite-ops-store.ts            # DDL conversation_summaries
├── services/
│   ├── compose-chat-prompt.ts         # HISTORY_WINDOW=8; bloco Resumo; ChatTurnInput.summary
│   ├── history-pruning.ts             # NOVO: elegibilidade, lote de 8, orquestra merge
│   ├── history-pruning.test.ts        # NOVO
│   ├── history-summarizer.ts          # NOVO: contrato + fake + prod (LLM)
│   ├── history-summarizer.test.ts     # NOVO (fake)
│   ├── run-chat.ts                    # pruning antes do strategy; summary no input; trace
│   └── run-chat.test.ts
├── context/
│   └── tokens.ts                      # contextBreakdown.summary opcional
├── agents/
│   ├── types.ts                       # TraceEvent summarize; ChatTurnInput.summary; Metrics breakdown
│   └── trace.ts                       # formatEvent summarize
└── http/
    └── server.test.ts                 # regressão historyMessages ≤ 8; summarize no trace quando elegível
```

**Structure Decision**: Projeto único. Persistência de resumo no `ConversationStore` (mesmo padrão 007). Lógica de “quando consolidar / qual lote” em serviço puro+orquestração (`history-pruning`), sumarizador injetável (`HistorySummarizer`) como o learning reflector. `runChat` continua o único orquestrador do turn.

## Phase 0: Research

Decisões em [research.md](research.md): cursor `covered_through_message_id`; janela 8; lote 8; mescla→~150; DI do sumarizador; evento no `runChat`; breakdown com `summary`.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/conversation-summary-store.md](contracts/conversation-summary-store.md), [contracts/history-summarizer.md](contracts/history-summarizer.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. DDL `conversation_summaries` em `SqliteOpsStore.ensureSchema`; estender `ConversationStore` (`getSummary`, `upsertSummary`, `messagesBefore`); impl SQLite + Memory; testes `:memory:` / fake.
2. `HISTORY_WINDOW = 8`; constantes `PRUNE_BATCH_SIZE = 8`, `SUMMARY_TARGET_TOKENS = 150`.
3. Contrato `HistorySummarizer` + fake determinístico + (prod) chamada de modelo com prompt de decisões/fatos/pendências e alvo ~150 tokens (`estimateTokens`).
4. `history-pruning.ts`: dado summary cursor + mensagens antes da janela, decidir consolidar; retornar `{ summaryText, didSummarize, event? }`.
5. `ChatTurnInput.summary`; `composeChatPrompt` / `toAgentMessages` / `normalizeChatTurnInput` injetam bloco `Resumo da conversa:`.
6. `TraceEvent` `summarize`; `formatTrace`; `runChat` consolida **antes** do `strategy.run`, faz upsert, passa `summary`, prepend do evento no `trace` só se consolidou.
7. `contextBreakdown.summary` via `estimateTokens(summary)`; `history` continua só mensagens cruas (0..8).
8. Testes `run-chat` / HTTP: janela 8, sem re-sumarizar mid-lote, mescla, evento só na consolidação; typecheck/test verdes.

## Complexity Tracking

Nenhuma violação constitucional.
