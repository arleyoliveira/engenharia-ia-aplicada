# Implementation Plan: Núcleo de Raciocínio do OpsPilot

**Branch**: `001-reasoning-core` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-reasoning-core/spec.md`

## Summary

Construir o núcleo de raciocínio do OpsPilot: um contrato único `ReasoningStrategy` (`name` + `run(input)` → `{ answer, trace, metrics }`), duas estratégias (ReAct via agente pré-construído do LangGraph e Plan-and-Execute como grafo planner→executor→replanner com máx. 8 passos), ferramentas operacionais (list_alerts, open_incident, resolve_incident) sobre MySQL via Sequelize com catálogo semeado, fábrica única de modelo OpenRouter (temperature 0) e uma arena CLI que compara estratégias sobre o mesmo input. Trace uniforme de eventos tipados e métricas (llmCalls, latencyMs) garantem comparabilidade; testes determinísticos sem rede cobrem store e formatação de traces.

## Technical Context

**Language/Version**: TypeScript ESM strict sobre Node.js 22 LTS

**Primary Dependencies**: `@langchain/core`, `@langchain/langgraph` (createReactAgent, StateGraph), `@langchain/openai` (ChatOpenAI apontando para o OpenRouter), `zod`, `sequelize` + `mysql2`, `tsx`

**Storage**: MySQL via Sequelize (models Service, Alert, Incident); seed reproduzível por script dedicado

**Testing**: `node:test` via `tsx` (`npm run test`), testes determinísticos sem rede para store e formatação de traces

**Target Platform**: CLI local (macOS/Linux), Node 22

**Project Type**: CLI tool (arena) + biblioteca de agentes

**Performance Goals**: Suíte de testes determinísticos < 10s; latência de arena dominada pela chamada ao modelo (sem meta rígida nesta fase)

**Constraints**: Temperatura 0; máx. 8 passos no planner; limite de iterações configurável; nenhuma leitura de `.env` em código — variáveis via opção nativa do Node (`--env-file`); testes de unidade não tocam rede nem banco real

**Scale/Scope**: 2 estratégias, 3 ferramentas, 5 serviços / 6 alertas no seed, 1 comando de arena

**Configuração de ambiente**: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (obrigatórias para execuções com LLM); `DATABASE_URL` (MySQL, ex.: `mysql://user:pass@localhost:3306/ops_pilot`) — adicionar a `.env.example`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|-----------|-----------|--------|
| I. Camadas MVC + funções puras | Models (Sequelize), Services (store de ferramentas, métricas, formatação de trace como funções puras), Controllers/borda (arena CLI, seed CLI). Domínio (tipos de trace, métricas) sem IO. | ✓ PASS |
| II. Validação na fronteira | Schemas Zod nos argumentos das ferramentas e nas flags da arena (`--strategies`, `--max-iterations`). | ✓ PASS |
| III. Erros de domínio | `ConfigError`, `ValidationError` (Zod), `NotFoundError`, `IterationLimitError` como classes; traduzidas na borda CLI com mensagem clara e saída não-zero. | ✓ PASS |
| IV. Teste em toda lógica nova | Testes determinísticos de store e traces antes/junto da implementação; `typecheck` + `test` verdes. | ✓ PASS |
| V. Segurança por padrão | Sem dotenv; `--env-file` nativo do Node; `.env` no `.gitignore` e nunca lido pelo agente; sem ações destrutivas. | ✓ PASS |
| VI. Spec antes do código | Artefatos em `specs/001-reasoning-core/` versionados; fluxo specify → plan → tasks → implement. | ✓ PASS |

Sem violações — Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-reasoning-core/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── cli.md           # Arena CLI + seed CLI
│   ├── tools.md         # Contratos das 3 ferramentas (schemas Zod)
│   └── trace.md         # Formato do trace, métricas e ReasoningStrategy
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── types.ts              # ReasoningStrategy, TraceEvent, Metrics (tipos puros)
│   ├── model.ts              # Fábrica única do modelo OpenRouter (ChatOpenAI, temperature 0)
│   ├── tools.ts              # list_alerts, open_incident, resolve_incident (Zod + store)
│   ├── react.ts              # Estratégia ReAct (createReactAgent pré-construído)
│   ├── plan-and-execute.ts   # Grafo planner → executor → replanner (máx. 8 passos)
│   └── trace.ts              # Formatação/serialização pura do trace
├── models/
│   ├── database.ts           # Conexão Sequelize via DATABASE_URL
│   ├── service.ts            # Model Service
│   ├── alert.ts              # Model Alert (status firing|resolved)
│   └── incident.ts           # Model Incident (severidade, estado)
├── services/
│   └── alert-store.ts        # Store: operações puras-de-domínio sobre os models
├── arena.ts                  # CLI: --strategies, --max-iterations, imprime traces/métricas
└── scripts/
    └── seed.ts               # Seed: 5 serviços, 6 alertas (3 firing, 3 resolved)

src/agents/ e src/services/ com testes colocados ao lado:
├── services/alert-store.test.ts   # Store (sem rede; banco em memória/sqlite de teste ou fakes)
└── agents/trace.test.ts           # Formatação de traces (determinístico)
```

**Structure Decision**: Projeto único (CLI). Camadas: `models/` (Sequelize/IO de banco), `services/` (store — lógica de domínio sobre os models), `agents/` (estratégias e tipos puros de trace/métricas), borda em `arena.ts` e `scripts/seed.ts`. Conforme a constituição, domínio (tipos, formatação de trace) não faz IO; efeitos ficam na borda e nos models.

## Complexity Tracking

Sem violações da constituição — seção intencionalmente vazia.

## Post-Design Constitution Check

Reavaliação após Fase 1 (data-model, contracts, quickstart):

- **I. MVC/funções puras**: mantido — `trace.ts` (formatação) e cálculo de métricas são puros; IO isolado em `models/` e borda. ✓
- **II. Zod na fronteira**: contratos de tools em `contracts/tools.md` definem schemas Zod; arena valida flags com Zod. ✓
- **III. Erros de domínio**: taxonomia definida (`ConfigError`, `NotFoundError`, `IterationLimitError`, Zod `ValidationError` na borda). ✓
- **IV. Testes**: quickstart inclui cenário determinístico sem rede; testes de store usam banco de teste isolado/fakes. ✓
- **V. Segurança**: `.env.example` ganha `DATABASE_URL`; nenhum segredo versionado; seed não é destrutivo (idempotente). ✓
- **VI. Spec antes do código**: todos os artefatos em `specs/001-reasoning-core/`. ✓

**GATE FINAL: PASS** — plano pronto para `/speckit-tasks`.
