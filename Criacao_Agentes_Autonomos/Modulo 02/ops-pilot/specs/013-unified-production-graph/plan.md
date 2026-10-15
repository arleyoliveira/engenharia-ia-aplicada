# Implementation Plan: Grafo unificado de produção

**Branch**: `013-unified-production-graph` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-unified-production-graph/spec.md`

## Summary

Cada turn de `POST /chat` passa por um único `StateGraph` em `src/agents/production-graph.ts`: `contexto` → `roteador` → exatamente uma de `react` | `plan-and-execute` | `reflection` → `resposta`. O roteador, sem override, usa `withStructuredOutput` (`route`, `reason`) e um prompt com a tabela das três rotas. O trace ganha um evento `route` e todo evento devolvido leva `node`. `strategy` no corpo deixa de ter default `react`: omitida, o roteador decide; presente e válida, é override (modelo do roteador não é chamado) e o evento marca `override: true`.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: `@langchain/langgraph` (`StateGraph`, `START`, `END`, `StateSchema`, `ReducedValue`); `withStructuredOutput` + Zod (`method: "functionCalling"`); `buildContext` em `src/context/context-builder.ts`; estratégias existentes (`react`, `plan-and-execute`, `withReflection`)

**Storage**: N/A (estado do grafo só no turn; conversa/memória permanecem nos stores atuais)

**Testing**: `node:test` + `tsx`; grafo com roteador e estratégias fakes; HTTP sem OpenRouter

**Target Platform**: Serviço HTTP OpsPilot (mesmo processo)

**Project Type**: Backend / web-service (extensão de 003 e 012)

**Performance Goals**: Um turn visita 4 nós (contexto, roteador, uma estratégia, resposta). Sem override, no máximo uma chamada extra de modelo (o roteador). Override: zero chamadas do roteador.

**Constraints**: Um único caminho de produção; sem default `react`; sem fallback se a saída do roteador for inválida; `node` em todo evento do trace HTTP; arena/CLI fora do grafo; typecheck e testes verdes

**Scale/Scope**: 1 grafo + carimbo de `node` + schema HTTP sem default + ajuste de `formatTrace` para o evento `route`; regressão de `runChat` e `POST /chat`

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: o grafo orquestra; `buildContext` continua puro e é chamado só pelo nó `contexto`. IO (histórico, recall, tools, append) permanece em `runChat`. HTTP só valida e traduz erro. Arena continua chamando estratégias direto, fora do chat de produção.
- [x] **II. Validação na fronteira**: Zod em `POST /chat` — `strategy` opcional, string trimada não vazia. Nome fora de `react` | `plan-and-execute` | `reflection` vira `422` antes de invocar o grafo. Saída do roteador é checada de novo no nó (enum + `reason` não vazio).
- [x] **III. Erros de domínio**: rota desconhecida → `422` / `UNKNOWN_STRATEGY` na borda. Saída inválida do roteador → `ModelOutputError` já existente, HTTP 500 via `toBoundaryMessage`. Sem fallback para `react`.
- [x] **IV. Teste é parte da tarefa**: grafo (ordem, exclusividade, tabela, evento `route`, `node`, override sem modelo) e HTTP (`strategy` omitida, override, `422`) sem rede. `npm run typecheck` e `npm run test` verdes.
- [x] **V. Segurança por padrão**: sem segredo novo; sem dotenv; o roteador de produção usa `createModel()` já existente.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência**: nenhum store novo. Testes HTTP/grafo seguem store em memória.

## Project Structure

### Documentation (this feature)

```text
specs/013-unified-production-graph/
├── checklists/requirements.md
├── contracts/
│   ├── production-graph.md
│   ├── trace-route.md
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
├── agents/
│   ├── production-graph.ts        # NOVO: StateGraph, prompt, schema, carimbo de node
│   ├── production-graph.test.ts   # NOVO: ordem, exclusividade, override, prompt, route
│   ├── types.ts                   # evento route + node opcional nos demais
│   ├── trace.ts                   # linha estável do evento route
│   ├── trace.test.ts              # serialização de route
│   ├── react.ts                   # inalterado (eventos sem node; o grafo carimba)
│   ├── plan-and-execute.ts        # inalterado
│   └── reflection.ts              # inalterado; o nó reflection usa withReflection(react)
├── services/
│   ├── run-chat.ts                # deixa de chamar strategy direto; invoca o grafo
│   └── run-chat.test.ts           # fakes entram como nós / roteador
└── http/
    ├── server.ts                  # strategy opcional; 422 nas três rotas; sem registry no chat
    └── server.test.ts             # omitida ≠ react implícito; override; 422
```

**Structure Decision**: Projeto único. O grafo mora em `src/agents/production-graph.ts` (invariante da spec). `runChat` continua dono do IO do turn e passa o material bruto ao grafo. O nó `contexto` é o único que chama `buildContext`. Estratégias existentes não conhecem o grafo; o carimbo `node` é feito na borda do nó de estratégia.

## Phase 0: Research

Decisões em [research.md](research.md): topologia do `StateGraph`; roteador injetável e prompt; override; `reflect`; carimbo de `node`; métricas; validação HTTP antes do grafo.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/production-graph.md](contracts/production-graph.md), [contracts/trace-route.md](contracts/trace-route.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Tipos: variante `route` (`route`, `reason`, `override`, `node: "roteador"`) e `node?` nas variantes já existentes. `formatTrace` ganha linha estável para `route` sem mudar as linhas dos outros tipos.
2. Constantes e helpers puros em `production-graph.ts`: `PRODUCTION_ROUTES`, `OVERRIDE_REASON`, `ROUTER_PROMPT` (tabela da spec), `stampTraceNode`.
3. `runProductionGraph(input, deps)` compila o `StateGraph` do turn: `contexto` chama `buildContext`; `roteador` só chama o modelo injetável/real se não houver override; aresta condicional para um único nó de estratégia; `resposta` devolve `{ answer, trace, metrics }` sem segundo `answer`.
4. Testes do grafo sem rede: visita `contexto → roteador → rota → resposta`; as outras duas estratégias com zero `run`; prompt contém a tabela; evento `route`; `node` em todo evento; override não invoca o roteador e usa o motivo estável; saída inválida lança `ModelOutputError` e não roda estratégia.
5. `runChat`: carrega histórico, resumo e recall; monta tools; invoca o grafo com esse material e os budgets; não chama `buildContext` nem `strategy.run` direto. `summarize` entra pelo nó `contexto` com `node: "contexto"`.
6. HTTP: `strategy` opcional sem `.default("react")`. Se vier, conferir `PRODUCTION_ROUTES` e responder `422` antes do grafo. Passar `strategy` + `reflect` ao `runChat`.
7. Atualizar testes de `run-chat` e `server` que assumem registry/`react` implícito.
8. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional.
