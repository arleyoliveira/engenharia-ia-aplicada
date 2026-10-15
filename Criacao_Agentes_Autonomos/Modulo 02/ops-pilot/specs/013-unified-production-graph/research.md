# Research: Grafo unificado de produção

**Date**: 2026-09-23 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição e o pipeline atual `runChat` → `buildContext` → `strategy.run`.

## R1. Topologia

- **Decision**: Um `StateGraph` por turn em `runProductionGraph`, no mesmo estilo de `plan-and-execute.ts` (`StateSchema`, `ReducedValue` no trace, `addConditionalEdges`). Nós e arestas:

  `START → contexto → roteador → (react | plan-and-execute | reflection) → resposta → END`

  O id de cada nó é exatamente `contexto`, `roteador`, `react`, `plan-and-execute`, `reflection`, `resposta`.
- **Rationale**: FR-001/FR-002. LangGraph já é a stack do projeto (constituição). Compilar dentro da função, como o plan-and-execute, fecha deps e contadores daquele turn.
- **Alternatives considered**: (a) `if/else` em `runChat` sem grafo — viola o arquivo e os nós pedidos; (b) três grafos, um por estratégia — não é um grafo unificado; (c) reusar o registry HTTP e só prefixar um evento `route` — o roteador não seria um nó e o override não pularia um modelo que não existe.

## R2. Quem monta o contexto

- **Decision**: `runChat` continua com o IO (janela, `maybeConsolidate`, recall, tools, append). Deixa de chamar `buildContext`. O nó `contexto` chama `buildContext(input, budgets)` e grava o resultado no estado. Se o turn consolidou resumo, esse nó acrescenta `{ type: "summarize", content, node: "contexto" }`.
- **Rationale**: FR-003. O builder permanece puro (constituição I). O evento `summarize` fica atribuído ao nó que a spec nomeia.
- **Alternatives considered**: (a) orçar em `runChat` e o nó `contexto` só repassar — o nó não seria o ponto que entrega o contexto; (b) mover recall e SQLite para dentro do grafo — IO no domínio.

## R3. Roteador

- **Decision**: Schema Zod `{ route: enum das rotas permitidas, reason: string min 1 }`. Produção: `createModel().withStructuredOutput(schema, { method: "functionCalling" })`, com uma retentativa no mesmo espírito de `invokeStructured` (não exportar nem refatorar o helper do plan-and-execute nesta feature). Prompt de sistema = `ROUTER_PROMPT`, contendo a tabela da spec (três linhas, critérios literais). Mensagem de usuário = só a `message` já orçada. Dep de teste: `routeModel.invoke(messages)` que registra o prompt e devolve `{ route, reason }`. Saída ausente, `route` fora do enum permitido ou `reason` em branco → `ModelOutputError`. Nenhum fallback.
- **Rationale**: FR-004/FR-005 e o edge case de saída inválida. `functionCalling` já é o método compatível com OpenRouter no projeto. Injetar o modelo mantém a suíte sem rede e permite assertar a tabela no prompt realmente enviado.
- **Alternatives considered**: (a) classificar por palavras-chave — não é `withStructuredOutput`; (b) mandar histórico e memórias ao roteador — custo extra sem requisito; (c) cair em `react` se o modelo falhar — a spec proíbe.

## R4. Override e `reflect`

- **Decision**:
  - `strategy` omitida e `reflect: false`: enum do roteador = as três rotas. `override: false`.
  - `strategy` omitida e `reflect: true`: enum do roteador = só `react` | `plan-and-execute` (a spec manda o roteador escolher a base). O nó dessa base roda com `withReflection`. Eventos que não são `critique` recebem `node` da base; `critique` recebe `node: "reflection"`. O evento `route` descreve a base e `override: false`.
  - `strategy` igual a `react` ou `plan-and-execute`: não chama o modelo. Evento `route` com `override: true`, `route` igual ao pedido, `reason` = `estratégia informada pelo cliente`. Se `reflect: true`, o mesmo nó é envolvido por `withReflection` (carimbo igual ao item anterior).
  - `strategy` ou rota do modelo igual a `reflection`: não há segundo nó. O nó `reflection` executa `withReflection(react)` (em produção) ou a estratégia injetada nesse id (em teste). Eventos da base (não `critique`) levam `node: "react"`; `critique` leva `node: "reflection"`.
- **Rationale**: Cobre o override (FR-009) e o parágrafo de `reflect` nas Assumptions sem criar uma quarta estratégia. A exclusividade (SC-002) mede `run` dos nós, não o campo `node` dos eventos internos.
- **Alternatives considered**: (a) `reflect: true` ignorar o roteador e forçar o nó `reflection` — contradiz “o roteador ainda escolhe a base”; (b) carimbar todo o trace do nó `reflection` com `node: "reflection"` — contradiz “eventos da base usam o id da base”.

## R5. Carimbo `node` e `formatTrace`

- **Decision**: `TraceEvent` ganha a variante `route`. Nas variantes já existentes, `node` é opcional no tipo para não obrigar cada literal interno das estratégias. `stampTraceNode(events, base)` preenche `node` na saída do nó de estratégia (`critique` → `reflection`; demais → `base`, e quando a rota é `reflection` a base é `react`). O trace HTTP que sai de `resposta` não tem evento sem `node`. `formatTrace` trata `route` como `[route] <route> override=<true|false> <reason>` e não altera o texto dos outros tipos (o campo `node` fica no objeto, não na linha).
- **Rationale**: FR-006/FR-007 sem reescrever ReAct e plan-and-execute. A linha nova é determinística para o teste de formatação.
- **Alternatives considered**: (a) `node` obrigatório em todo literal do repositório — diff amplo sem mudança de comportamento dentro da estratégia; (b) imprimir `node` em toda linha — quebra o texto estável já testado em `trace.test.ts`.

## R6. Métricas e resposta

- **Decision**: O nó `resposta` não gera outro `answer`. Repassa o `answer` da estratégia. `metrics.llmCalls` e `metrics.promptTokens` = soma do roteador (0 no override; 1 chamada e o usage dela quando o modelo rodou) + métricas da estratégia. `latencyMs` = parede do `runProductionGraph` inteiro, não a soma das latências internas. `historyMessages`, `recalledMemories` e `contextBreakdown` vêm do `buildContext` do nó `contexto`.
- **Rationale**: FR-011. Contar a chamada do roteador mantém `llmCalls` como invocações reais (núcleo 001). Não somar `latencyMs` da estratégia evita dupla contagem.
- **Alternatives considered**: (a) métricas só da estratégia, roteador invisível — subconta chamadas; (b) evento `answer` extra no nó `resposta` — a spec diz para não inventar segunda resposta.

## R7. HTTP antes do grafo

- **Decision**: `chatRequestSchema.strategy` passa a `z.string().trim().min(1).optional()` (sem default). Conjunto válido exportado: `PRODUCTION_ROUTES`. Nome fora do conjunto → `422` `UNKNOWN_STRATEGY` e o grafo não é invocado. `createChatServer` deixa de resolver estratégia pelo registry; recebe deps do grafo (`strategies` + `routeModel`) com default de produção (`reactStrategy`, `planAndExecuteStrategy`, `withReflection(reactStrategy)`, modelo real). O registry em `src/agents/index.ts` permanece para a arena.
- **Rationale**: FR-008/FR-010. `reflection` não está no registry hoje; a lista de rotas do chat é a do grafo, não `registry.names()`.
- **Alternatives considered**: (a) manter `.default("react")` e tratar default como “não é override” — impossível distinguir omitido de explícito, e a spec remove o default; (b) `422` só depois de entrar no grafo — a spec exige não executar nó de estratégia.
