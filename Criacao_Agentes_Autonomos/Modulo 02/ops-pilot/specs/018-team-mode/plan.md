# Implementation Plan: Modo equipe

**Branch**: `018-team-mode` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-team-mode/spec.md`

## Summary

A rota `team` entra no grafo de produção já existente. O modo, em `src/team/`, é um `StateGraph` cujo supervisor decide com `withStructuredOutput` (`next`, `brief`) sobre um blackboard no estado do turno. O analista só recebe ferramentas de leitura e só escreve achados. O planejador não recebe ferramentas e só substitui o plano. O executor só invoca `open_incident` e `resolve_incident` depois do handoff, pelos mesmos objetos de tool do turno. Cada decisão vira um evento `handoff` no trace e em "ver raciocínio". O turno aceita 8 handoffs.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: `@langchain/langgraph` (`StateGraph`, `START`, `END`, `StateSchema`, `ReducedValue`); `withStructuredOutput` + Zod (`method: "functionCalling"`); `createModel` e `createLlmCallCounter`; tools já criadas em `src/agents/tools.ts`

**Storage**: N/A para o blackboard (só o estado do turno). O trace do pedido, incluindo `handoff`, continua no store de trace já usado por `runChat`.

**Testing**: `node:test` + `tsx` no grafo da equipe, no grafo de produção, no formatador e no HTTP, com supervisor, papéis e roteador fakes. Vitest em `web/` para `presentTrace` e "ver raciocínio".

**Target Platform**: Serviço HTTP OpsPilot e a war room em `web/`

**Project Type**: Web-service com painel (extensão do grafo de produção e do trace da war room)

**Performance Goals**: No máximo 8 decisões de supervisor por turno. Cada visita de analista ou executor faz no máximo uma rodada de ferramenta; o planejador faz uma saída estruturada. `strategy: "team"` não chama o modelo do roteador.

**Constraints**: Quatro rotas e nenhuma a mais; sem fallback de papel; executor sem acesso direto ao store e sem as tools de leitura; `reflect: true` não embrulha `team`; `node` preservado nos eventos da equipe; typecheck e testes verdes

**Scale/Scope**: Um módulo `src/team/`, a quarta rota no grafo de produção, uma variante de trace e duas linhas no painel. Sem campo novo em `POST /chat` e sem tabela nova.

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: o blackboard e a allowlist são funções puras em `src/team/`. O grafo só orquestra. Mutação de incidente continua dentro de `tool.invoke` das tools já existentes. HTTP só valida `strategy` contra `PRODUCTION_ROUTES`. `src/team/` não importa store nem Express.
- [x] **II. Validação na fronteira**: Zod no schema do supervisor (`next` enum, `brief` não vazio depois do trim) e no plano do planejador. Argumentos de `open_incident` e `resolve_incident` continuam validados pelo schema que essas tools já têm. Nome de tool fora da lista filtrada não chega a `invoke`.
- [x] **III. Erros de domínio**: saída inválida do supervisor ou do planejador → `ModelOutputError`. Indisponibilidade → `ModelUnavailableError`. `strategy` desconhecida → `422` / `UNKNOWN_STRATEGY` já existente, agora com quatro rotas legais.
- [x] **IV. Teste é parte da tarefa**: ciclo, allowlist, teto, handoff, rota e painel sem rede. `npm run typecheck` e `npm run test` verdes.
- [x] **V. Segurança por padrão**: sem segredo novo e sem dotenv. O executor não ganha caminho que grave incidente fora das duas tools. `forget_preference` não entra na allowlist.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência**: nenhum store novo. Testes seguem SQLite em memória ou store de conversa em memória, como hoje.

## Project Structure

### Documentation (this feature)

```text
specs/018-team-mode/
├── checklists/requirements.md
├── contracts/
│   ├── chat-http.md
│   ├── handoff-trace.md
│   └── team-mode.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── team/
│   ├── blackboard.ts            # NOVO: tipo e transições puras do quadro
│   ├── blackboard.test.ts
│   ├── allowlist.ts             # NOVO: toolsFor(papel, tools)
│   ├── allowlist.test.ts
│   ├── roles.ts                 # NOVO: uma rodada de tool / plano estruturado
│   ├── team-graph.ts            # NOVO: StateGraph, schema do supervisor, teamStrategy
│   └── team-graph.test.ts       # ciclo, teto, erro, ferramentas recebidas
├── graph/
│   ├── production-Graph.ts      # rota team, prompt, sem embrulhar reflexão, preserva node
│   └── production-Graph.test.ts # quatro rotas, linha team, override, reflect
├── agents/
│   ├── types.ts                 # variante handoff
│   ├── trace.ts                 # linha [handoff]
│   └── trace.test.ts
├── http/
│   └── server.test.ts           # strategy team; mapa de strategies com a chave team
└── services/
    └── run-chat.test.ts         # mapa de strategies com a chave team, se o tipo exigir
web/src/
├── model/
│   ├── trace-lines.ts           # linhas next e brief
│   └── trace-lines.test.ts
└── ui/
    └── WarRoom.test.tsx         # ver raciocínio mostra o handoff
```

**Structure Decision**: Projeto único. O invariante `src/team/` guarda o quadro, a allowlist, os runners e o grafo da equipe. O grafo de produção só ganha a rota e deixa de reescrever `node` quando o evento já veio carimbado. A war room não ganha componente: `presentTrace` passa a conhecer o tipo.

## Phase 0: Research

Decisões em [research.md](research.md): encaixe da rota; topologia e teto; saída estruturada injetável; formato do blackboard; allowlist com uma rodada e sem store; evento `handoff` e carimbo; reflexão e métricas; fakes das três rotas antigas.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/team-mode.md](contracts/team-mode.md), [contracts/handoff-trace.md](contracts/handoff-trace.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Tipos: variante `handoff` (`next`, `brief`, `node: "supervisor"`). `formatTrace` ganha `[handoff] <next> <brief>` sem alterar as outras linhas.
2. `blackboard.ts`: estado vazio, acrescentar achados, substituir plano, acrescentar ação e recado. Testes puros dessas quatro escritas e da recusa de escrita cruzada (o helper do analista não recebe campo de plano).
3. `allowlist.ts`: `toolsFor` com os três conjuntos. Teste com uma lista que inclui as seis tools operacionais e `forget_preference`.
4. `team-graph.ts`: schema Zod, prompt, `TEAM_HANDOFF_LIMIT`, grafo da seção R2. `teamStrategy` aceita `TeamDeps`. Runners padrão em `roles.ts` (uma rodada; planejador estruturado; `invoke` só na lista filtrada).
5. Testes do grafo da equipe sem rede, cobrindo o contrato [contracts/team-mode.md](contracts/team-mode.md): ordem, quadro acumulado, allowlist vista por cada papel, zero `invoke` de incidente sem handoff `executor`, teto 8 com e sem `fim`, saída inválida.
6. `production-Graph.ts`: incluir `team` em `PRODUCTION_ROUTES`, na tabela do prompt, nas arestas e em `defaultStrategies`. Não aplicar `withReflection` quando a rota é `team`. Se o evento já tem `node`, conservá-lo. Atualizar os mapas de strategy dos testes para a quarta chave.
7. `presentTrace` e o teste da war room: evento `handoff` com `next` e `brief`, painel sem `fetch` extra.
8. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional.
