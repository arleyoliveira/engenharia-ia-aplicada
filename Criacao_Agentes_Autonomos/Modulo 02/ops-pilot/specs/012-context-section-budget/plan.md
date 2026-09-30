# Implementation Plan: Orçamento de contexto por seção

**Branch**: `012-context-section-budget` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-context-section-budget/spec.md`

## Summary

Um **ContextBuilder** puro em `src/context/context-builder.ts` aplica teto por seção (via `CONTEXT_BUDGET_*`, padrões summary **200** / window **1200** / memories **300**) sobre o material do turn **antes** de qualquer estratégia. System e mensagem são intocáveis; janela corta as mais antigas; memórias cortam menor score; resumo reduz pelo prefixo até caber. `runChat` é o único ponto que orça e passa o resultado a todas as estratégias; métricas refletem o pós-corte. Testes com tetos baixos, sem rede.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: `estimateTokens` (`src/context/tokens.ts`); Express/Zod inalterados; env nativo Node (sem dotenv)

**Storage**: N/A (orçamento em memória no turn; sem DDL)

**Testing**: `node:test` + `tsx`; builder unitário com tetos explícitos; `runChat` + fake strategy; sem OpenRouter

**Target Platform**: Serviço HTTP OpsPilot (mesmo processo)

**Project Type**: Backend / web-service (extensão de 007/008/010/011)

**Performance Goals**: Orçamento O(n) nas mensagens/memórias do turn; zero chamada extra de modelo

**Constraints**: Domínio puro (builder sem IO); env lido na borda; system/message nunca truncados; métricas pós-corte; todas as estratégias sem bypass; typecheck/test verdes

**Scale/Scope**: 1 módulo de orçamento + resolução de tetos + wiring em `runChat` (score no recall) + formatação existente reutilizada; testes unitários + regressão chat

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: `buildBudgetedContext` / políticas de corte são funções puras em `src/context/`. `resolveSectionBudgets` lê env na borda (chamado por `runChat` / testes). HTTP e estratégias não implementam teto.
- [x] **II. Validação na fronteira**: request Zod de `/chat` inalterado. Env inválido (não numérico, ≤ 0) cai no padrão da seção — não atravessa valor inválido como teto.
- [x] **III. Erros de domínio**: orçamento nunca falha o turn; corte é comportamento normal. Erros HTTP existentes permanecem.
- [x] **IV. Teste é parte da tarefa**: tetos baixos / ordem de corte / intocáveis / defaults / métricas pós-corte; `npm run typecheck` e `npm run test` verdes.
- [x] **V. Segurança por padrão**: sem segredo novo; sem dotenv; `CONTEXT_BUDGET_*` são inteiros de configuração.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência**: nenhum store novo; testes não abrem arquivo de produção por causa desta feature.

## Project Structure

### Documentation (this feature)

```text
specs/012-context-section-budget/
├── checklists/requirements.md
├── contracts/
│   ├── context-builder.md
│   └── chat-http.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── context/
│   ├── tokens.ts                    # existente (estimateTokens / breakdown)
│   ├── context-builder.ts           # NOVO: budgets, corte por seção, buildBudgetedContext
│   └── context-builder.test.ts      # NOVO: tetos baixos, ordem de corte, defaults
├── services/
│   ├── compose-chat-prompt.ts       # formatação inalterada na API; recebe input já orçado
│   ├── run-chat.ts                  # resolve budgets + build antes do strategy; métricas pós-corte
│   └── run-chat.test.ts             # métricas / input da strategy refletem corte
├── agents/
│   └── types.ts                     # opcional: tipo auxiliar se necessário; ChatTurnInput segue
└── http/
    └── server.test.ts               # regressão; sem mudança de contrato de erro
```

**Structure Decision**: Projeto único. Orçamento fica em `src/context/context-builder.ts` (invariante). Formatação (`composeChatPrompt` / `toAgentMessages`) permanece em `compose-chat-prompt.ts` e continua a ser o que as estratégias chamam — mas só sobre material **já orçado** por `runChat`. Assim não há bypass e não se duplica formatação em três agentes.

## Phase 0: Research

Decisões em [research.md](research.md): wiring em `runChat`; nomes `CONTEXT_BUDGET_*`; políticas de corte; score no recall; system opcional no builder; métricas pós-corte.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/context-builder.md](contracts/context-builder.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Constantes de padrão + `resolveSectionBudgets(env)` + tipos `SectionBudgets` / `ContextBuilderInput` / `BudgetedContext` em `context-builder.ts`.
2. Políticas puras: `trimSummaryToBudget`, `trimWindowOldestFirst`, `trimMemoriesLowestScoreFirst`; `buildBudgetedContext(input, budgets)`.
3. Testes unitários com tetos baixos: intocáveis; janela; memórias; resumo; defaults; env inválido → padrão.
4. `runChat`: recall mantém `{ fact, score }`; `buildBudgetedContext` após janela/resumo/recall e **antes** de `strategy.run`; passar `message` / `history` / `memories` / `summary` orçados; `contextBreakdown` / `historyMessages` / `recalledMemories` no material orçado.
5. Confirmar que ReAct / plan-and-execute / reflection só veem o input orçado (sem segundo caminho). Regressão `run-chat` + HTTP.
6. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional.
