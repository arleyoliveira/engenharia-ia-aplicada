# Feature Specification: Grafo unificado de produção

**Feature Branch**: `013-unified-production-graph`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "grafo unificado: production-graph.ts: nós contexto, roteador, as 3 estratégias como nós e resposta. Roteador: withStructuredOutput (route, reason); tabela no prompt; evento "route" campo node em todo evento de trace. /chat: strategy opcional (se vier, é override no trace)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Um único grafo executa o turn (Priority: P1)

Todo chat de produção passa por um único grafo: primeiro o nó de contexto monta o material do turn, depois o roteador escolhe exatamente uma estratégia, essa estratégia roda como nó, e o nó de resposta entrega a resposta do turn. Não há caminho de produção que execute uma estratégia fora desse grafo.

**Why this priority**: Sem o grafo único, roteamento e trace por nó não têm onde existir. É o fluxo mínimo que o plantonista já usa no chat.

**Independent Test**: Com estratégias e roteador fakes (sem rede), enviar uma mensagem sem `strategy` e verificar que a execução visita, nesta ordem, contexto → roteador → exatamente um nó de estratégia → resposta, e que `answer` / `trace` / `metrics` saem do nó de resposta.

**Acceptance Scenarios**:

1. **Given** uma mensagem válida e `strategy` omitida, **When** o cliente chama `POST /chat`, **Then** o turn percorre o grafo de produção (contexto, roteador, uma estratégia, resposta) e a resposta HTTP `200` traz `answer`, `trace` e `metrics` produzidos por esse grafo.
2. **Given** as três estratégias do OpsPilot (`react`, `plan-and-execute`, `reflection`), **When** o roteador fake devolve cada uma em turnos separados, **Then** só o nó da rota escolhida executa; os outros dois nós de estratégia não rodam naquele turn.
3. **Given** o material de contexto já orçado (system, mensagem, resumo, janela, memórias), **When** o nó de contexto entrega o turn, **Then** o nó de estratégia escolhido recebe esse material e nenhum caminho paralelo remonta o prompt sem o grafo.

---

### User Story 2 - O roteador explica a escolha e cada evento diz o nó (Priority: P1)

Quando o cliente não força a estratégia, o roteador decide com saída estruturada (`route` e `reason`) guiado por uma tabela no prompt. O trace do turn inclui um evento `route` e todo evento de trace carrega o nó que o produziu, para o operador ver por que aquela estratégia rodou e de onde veio cada passo.

**Why this priority**: A escolha opaca não serve plantão. O valor do roteador é a decisão observável, no mesmo trace que o operador já lê.

**Independent Test**: Sem rede, injetar uma saída estruturada `{ route, reason }` e assertar: (a) o prompt do roteador contém a tabela com as três rotas; (b) o trace tem um evento `route` com essa rota, o motivo e `node` igual a `roteador`; (c) todo evento do turn tem `node` preenchido com o id do nó que o emitiu.

**Acceptance Scenarios**:

1. **Given** `strategy` omitida e o roteador devolvendo `route: "react"` e um `reason` não vazio, **When** o turn termina, **Then** o trace contém um evento `type: "route"` com essa `route`, esse `reason`, `override: false` e `node: "roteador"`.
2. **Given** o prompt enviado ao roteador, **When** ele é inspecionado no teste, **Then** contém uma tabela com uma linha para `react`, uma para `plan-and-execute` e uma para `reflection`, cada uma dizendo quando usar aquela rota.
3. **Given** um turn que também emite eventos da estratégia (por exemplo `thought` ou `answer`) e, se houver, `summarize` na preparação de contexto, **When** o trace é devolvido, **Then** cada evento tem `node` igual ao nó de origem (`contexto`, `roteador`, o id da estratégia ou o que esse nó emitiu) e nenhum evento chega sem `node`.

---

### User Story 3 - O cliente força a estratégia e o trace marca o override (Priority: P2)

O corpo de `POST /chat` aceita `strategy` de forma opcional. Se o campo vier, ele prevalece sobre o roteador: o modelo do roteador não é chamado, a estratégia informada é o único nó de estratégia executado, e o evento `route` registra que foi override.

**Why this priority**: Quem compara estratégias ou reproduz um incidente precisa fixar o caminho sem depender do modelo. Depende do grafo e do evento `route` já existirem.

**Independent Test**: Sem rede, chamar `POST /chat` com `strategy: "plan-and-execute"` e um roteador que falharia se fosse invocado; confirmar que o roteador não é chamado, que só esse nó roda e que o evento `route` tem `override: true` e `route: "plan-and-execute"`.

**Acceptance Scenarios**:

1. **Given** `strategy: "plan-and-execute"`, **When** o cliente chama `POST /chat`, **Then** o nó `plan-and-execute` executa, o modelo do roteador não é chamado e o trace tem evento `route` com `route: "plan-and-execute"`, `override: true`, `node: "roteador"` e motivo estável de override.
2. **Given** `strategy` omitida, **When** o cliente chama `POST /chat`, **Then** o roteador decide (não há mais padrão silencioso `react`) e o evento `route` tem `override: false`.
3. **Given** `strategy` com nome fora das três rotas, **When** o cliente chama `POST /chat`, **Then** a resposta é `422` identificando a estratégia desconhecida e nenhum nó de estratégia executa.
4. **Given** `strategy: "react"` enviado de propósito e, noutro turn, `strategy` omitida com o roteador também escolhendo `react`, **When** os traces são comparados, **Then** só o primeiro tem `override: true`.

---

### Edge Cases

- `strategy` ausente é válido e significa “roteador decide”. String vazia, só espaços ou tipo inválido continua `400` com `issues` de validação.
- `strategy` desconhecida continua `422`; o grafo não escolhe um fallback.
- Saída do roteador sem `route`/`reason`, ou com `route` fora de `react` | `plan-and-execute` | `reflection`: o turn falha como erro de saída de modelo já traduzido na borda (sem escolher `react` em silêncio).
- Override não chama o modelo do roteador, mesmo que o modelo esteja indisponível.
- `reflect: true` com `strategy` `react` ou `plan-and-execute` continua envolvendo essa base na camada de reflexão; eventos da base usam o `node` da base e eventos do crítico usam `node: "reflection"`. O evento `route` continua descrevendo a base pedida (ou a rota do modelo) e o override, se houver.
- `strategy: "reflection"` seleciona o nó `reflection` (base ReAct sob a camada de reflexão) e, se veio no corpo, é override.
- Evento `summarize` já existente, quando ocorrer na preparação do turn, entra no trace com `node: "contexto"`.
- Timeout de 180s, corpo inválido e demais códigos HTTP do chat permanecem os atuais.
- O nó `resposta` entrega o `answer` da estratégia escolhida; não inventa uma segunda resposta.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST executar cada turn de produção do chat por um único grafo em `src/agents/production-graph.ts`, com os nós `contexto`, `roteador`, um nó por estratégia e `resposta`, nesta ordem: contexto → roteador → exatamente uma estratégia → resposta.
- **FR-002**: Os nós de estratégia MUST ser as três estratégias já existentes: `react`, `plan-and-execute` e `reflection`. Em cada turn MUST executar só o nó cuja rota foi escolhida.
- **FR-003**: O nó `contexto` MUST ser o ponto que entrega o contexto do turn (material já orçado pelo ContextBuilder) aos nós de estratégia. MUST NOT existir caminho de produção que rode estratégia fora do grafo ou remonte esse contexto em paralelo.
- **FR-004**: O nó `roteador`, quando não houver override, MUST obter a decisão com saída estruturada de campos `route` e `reason` (`route` restrita às três estratégias; `reason` texto não vazio).
- **FR-005**: O prompt do roteador MUST incluir uma tabela com uma linha por estratégia (`react`, `plan-and-execute`, `reflection`) indicando quando usar cada rota, conforme a tabela em Assumptions.
- **FR-006**: O trace do turn MUST conter um evento `type: "route"` com `route`, `reason`, `override` (booleano) e `node: "roteador"`.
- **FR-007**: Todo evento de trace devolvido no turn (`route`, `summarize`, `thought`, `action`, `observation`, `plan`, `critique`, `answer` e qualquer outro tipo já emitido) MUST ter o campo `node` com o id do nó que o produziu.
- **FR-008**: `POST /chat` MUST aceitar `strategy` como opcional. Omitida, o roteador decide e `override` é `false`. Não MUST haver default silencioso `react`.
- **FR-009**: Se `strategy` vier e for uma das três rotas, o sistema MUST usar essa estratégia como override: não chamar o modelo do roteador, executar só esse nó e gravar o evento `route` com `override: true`, `route` igual ao valor enviado e `reason` estável `estratégia informada pelo cliente`.
- **FR-010**: Se `strategy` vier e não for uma das três rotas, a rota MUST responder `422` com a estratégia desconhecida, sem executar nó de estratégia.
- **FR-011**: O nó `resposta` MUST ser a saída única do grafo para o contrato já existente `{ answer, trace, metrics }`.
- **FR-012**: Testes automatizados MUST cobrir, sem rede: ordem dos nós e exclusividade da estratégia escolhida; tabela no prompt; evento `route` com `route`/`reason`/`override`/`node`; `node` presente em todo evento; override não invoca o roteador; `strategy` omitida não vira `react` implícito; `strategy` desconhecida → `422`.

### Key Entities

- **ProductionGraph**: grafo de um turn, com nós `contexto`, `roteador`, `react`, `plan-and-execute`, `reflection` e `resposta`.
- **RouteDecision**: decisão do roteador ou do override — `route` (uma das três estratégias), `reason` (texto) e `override` (se o cliente fixou a estratégia).
- **TraceEvent**: evento observável do turn; passa a exigir `node` (id do nó de origem). O tipo `route` carrega também `route`, `reason` e `override`.
- **ChatRequest.strategy**: texto opcional. Ausente = roteador. Presente = override, se for rota conhecida.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turns de teste sem override, a execução visita contexto, roteador, exatamente uma estratégia e resposta, e a resposta HTTP de sucesso sai desse grafo.
- **SC-002**: Em 100% dos turns de teste, cada uma das três rotas injetadas executa só o próprio nó (os outros dois permanecem com zero execuções naquele turn).
- **SC-003**: Em 100% dos turns de teste sem override, o trace contém um evento `route` cujo `route` e `reason` coincidem com a saída estruturada do roteador e cujo `override` é falso.
- **SC-004**: Em 100% dos eventos de trace devolvidos nos testes desta feature, o campo `node` está presente e corresponde ao nó que emitiu o evento.
- **SC-005**: Em 100% dos turns de teste com `strategy` válida, o modelo do roteador é chamado zero vezes e o evento `route` marca override com a estratégia pedida.
- **SC-006**: Em 100% dos pedidos de teste com `strategy` desconhecida, a resposta é `422` e nenhum nó de estratégia executa.
- **SC-007**: O prompt do roteador, inspecionado em teste, inclui as três rotas numa tabela; a suíte desta feature conclui sem rede.

## Assumptions

- Typo do pedido (`overidade`) normalizado para override.
- As três estratégias são as já existentes no OpsPilot: `react`, `plan-and-execute` e `reflection` (camada de reflexão sobre a base ReAct quando a rota é `reflection`). Não se cria uma quarta estratégia.
- Tabela do prompt do roteador (conteúdo mínimo exigido; redação fina pode ajustar no plano desde que as três rotas e o critério permaneçam):

  | route | quando usar |
  |-------|-------------|
  | react | consulta ou ação operacional resolvível com ferramentas em poucas iterações |
  | plan-and-execute | pedido com vários passos dependentes que precisa de um plano explícito |
  | reflection | pedido em que a resposta precisa de revisão crítica antes de ser entregue |

- `node` usa os ids `contexto`, `roteador`, `react`, `plan-and-execute`, `reflection`. Eventos internos da estratégia base usam o id dessa base; eventos do crítico usam `reflection`.
- Motivo estável de override: `estratégia informada pelo cliente`.
- `reflect: true` permanece no contrato atual e não substitui o campo `strategy`. Com `strategy` omitida e `reflect: true`, o roteador ainda escolhe a base (`react` ou `plan-and-execute`); a camada de reflexão envolve essa base e os eventos do crítico usam `node: "reflection"`. Rota de modelo `reflection` ou `strategy: "reflection"` entra direto no nó `reflection`.
- O default Zod `strategy = "react"` deixa de existir. Clientes que omitiam `strategy` e dependiam de ReAct passam a receber a escolha do roteador.
- Saída inválida do roteador reutiliza o erro de saída de modelo já existente (HTTP 500 na borda atual); sem fallback.
- Contratos de `message`, `reflect`, `conversationId`, `userId`, timeout 180s, `400` e formato `{ answer, trace, metrics }` permanecem. Arena/CLI que invocam estratégias direto ficam fora deste grafo de produção.
- O arquivo `src/agents/production-graph.ts` é invariante do pedido. Wiring com `runChat` e o schema HTTP fica para `/speckit-plan`.
