# Feature Specification: Modo equipe

**Feature Branch**: `018-team-mode`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Modo equipe /src/team/: supervisor com withStructuredOutput({next, brief}) sobre um blackboard no estado. Papéis: analista (só leitura, não propõe), planejador (sem tools), executor (incidentes, sem bypass). Evento "handoff" no trace, renderizado no "ver raciocínio". Rota "team", teto 8"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - O plantonista recebe um turno coordenado por papéis (Priority: P1)

Quando a rota do turno é `team`, um supervisor lê o quadro compartilhado do turno (blackboard), escolhe o próximo papel e entrega um recado curto. Só esse papel trabalha, devolve o que fez ao quadro, e o supervisor decide de novo. O turno termina quando o supervisor encerra, e a resposta do chat sai desse trabalho — os outros modos (`react`, `planExecute`, `reflect`) não rodam nesse turno.

**Why this priority**: Sem o ciclo supervisor → um papel → quadro, não há modo equipe. É o fluxo que o plantonista passa a poder usar no chat.

**Independent Test**: Sem rede, forçar a rota `team` com um supervisor fake que devolve primeiro o analista, depois o planejador, depois o executor e por fim o encerramento. Verificar que cada papel roda uma vez, que o quadro acumula o que cada um escreveu, que os outros modos não executam e que a resposta HTTP `200` traz `answer`, `trace` e `metrics`.

**Acceptance Scenarios**:

1. **Given** `strategy: "team"` e o supervisor devolvendo, em sequência, `analista`, `planejador`, `executor` e `fim`, cada um com um `brief` não vazio, **When** o cliente chama `POST /chat`, **Then** os papéis rodam nessa ordem, cada um vê o quadro atualizado pelos anteriores, o modelo do roteador não é chamado e a resposta `200` traz `answer`, `trace` e `metrics` produzidos por esse turno.
2. **Given** a mesma sequência, **When** o turno termina com `next: "fim"`, **Then** a `answer` é o `brief` desse encerramento e nenhum papel roda depois do `fim`.
3. **Given** a rota `team`, **When** o turno executa, **Then** os modos `react`, `planExecute` e `reflect` permanecem com zero execuções nesse turno.
4. **Given** o quadro vazio no início do turno, **When** o supervisor é chamado pela primeira vez, **Then** ele ainda decide só com a mensagem do plantonista e o quadro vazio, e a primeira escrita no quadro é a do papel escolhido.

---

### User Story 2 - Cada papel fica no seu limite (Priority: P1)

O analista só consulta e registra o que encontrou: não abre nem resolve incidente e não escreve o plano. O planejador não tem ferramentas; só registra o plano no quadro. O executor só abre ou resolve incidente pelas ferramentas de incidente que o OpsPilot já usa, com a mesma validação, e só depois de um handoff do supervisor para ele.

**Why this priority**: O modo equipe perde o sentido se qualquer papel puder ler, planejar e agir. O limite de cada papel é o que o plantonista confia ao inspecionar o turno.

**Independent Test**: Sem rede, inspecionar as ferramentas entregues a cada papel e o campo do quadro que cada um pode escrever. O analista só recebe ferramentas de leitura; o planejador recebe lista vazia; o executor só recebe `open_incident` e `resolve_incident`. Um turno em que o supervisor não chama o executor deixa o store de incidentes intacto.

**Acceptance Scenarios**:

1. **Given** um handoff para `analista`, **When** o analista roda, **Then** as únicas ferramentas disponíveis são de leitura (`list_alerts`, `list_incidents`, `consultar_runbook`, `check_provider_status`), o que ele acrescenta ao quadro fica em achados, e ele não escreve o plano nem uma ação de incidente.
2. **Given** um handoff para `planejador`, **When** o planejador roda, **Then** ele não recebe ferramenta alguma e a única escrita dele no quadro é o plano.
3. **Given** um handoff para `executor` com um plano que pede abrir ou resolver incidente, **When** o executor age, **Then** ele só pode chamar `open_incident` e `resolve_incident`, os mesmos já usados pelo copilot, com a validação de argumentos que essas ferramentas já fazem.
4. **Given** um turno `team` cujo supervisor nunca escolhe `executor`, **When** o turno termina, **Then** nenhum incidente é aberto ou resolvido por esse turno.
5. **Given** o executor, **When** o turno é montado, **Then** não existe caminho em que ele grave incidente direto no store, receba as ferramentas de leitura ou as do planejador, ou dispense a validação dessas duas ferramentas.

---

### User Story 3 - O plantonista vê cada handoff em "ver raciocínio" (Priority: P1)

Cada decisão do supervisor vira um evento `handoff` no trace, com o papel escolhido e o recado. Em "ver raciocínio", esse evento aparece na ordem do turno, com esses dois campos, no mesmo painel dos outros tipos.

**Why this priority**: A resposta final não mostra quem fez o quê. O handoff é o que permite ao plantonista acompanhar a equipe.

**Independent Test**: Um `200` fake cujo `trace` tem um evento `handoff` entre outros tipos já conhecidos. "ver raciocínio" mostra `next` e `brief` desse evento, na posição em que ele está no array, sem novo `POST`.

**Acceptance Scenarios**:

1. **Given** um turno `team` em que o supervisor escolhe `analista` com um `brief`, **When** o trace é devolvido, **Then** ele contém um evento `type: "handoff"` com esse `next`, esse `brief` e `node: "supervisor"`, na ordem em que a decisão ocorreu.
2. **Given** um `200` cujo `trace` inclui `handoff`, **When** o plantonista aciona "ver raciocínio", **Then** o painel lista esse evento na ordem do `trace` e mostra os campos `next` e `brief`. O `node`, quando vier, continua como metadado do evento. Os tipos já renderizados (`thought`, `action`, `plan`, `route` e os demais) permanecem como estão.
3. **Given** o painel aberto num turno que tem `handoff`, **When** o plantonista fecha "ver raciocínio", **Then** o chat não é chamado outra vez.
4. **Given** eventos emitidos por um papel (por exemplo `action` do executor ou `plan` do planejador), **When** o trace é devolvido, **Then** cada um traz `node` igual ao papel que o emitiu (`analista`, `planejador` ou `executor`).

---

### User Story 4 - A rota `team` entra no roteador e para no oitavo handoff (Priority: P2)

`team` passa a ser uma rota de produção: o roteador pode escolhê-la e o cliente pode fixá-la com `strategy`. Um turno aceita no máximo 8 handoffs. No oitavo, se o supervisor ainda não encerrou, o turno para com a mesma mensagem de limite já usada pelos outros modos.

**Why this priority**: Sem a rota, o modo não é alcançável no chat. Sem o teto, um supervisor que não encerra segura o plantão. Os dois dependem do ciclo da história 1.

**Independent Test**: Sem rede, (a) omitir `strategy` e injetar `route: "team"` no roteador, confirmando que só o modo equipe roda e que o evento `route` marca `override: false`; (b) um supervisor que sempre devolve `analista` gera no máximo 8 handoffs e a resposta de limite.

**Acceptance Scenarios**:

1. **Given** `strategy` omitida e o roteador devolvendo `route: "team"` com um `reason` não vazio, **When** o turno termina, **Then** só o modo equipe executa e o trace tem evento `route` com `route: "team"`, esse `reason`, `override: false` e `node: "roteador"`.
2. **Given** o prompt do roteador, **When** ele é inspecionado no teste, **Then** a tabela de rotas inclui uma linha `team` dizendo quando usar esse modo, além das três rotas já existentes.
3. **Given** `strategy: "team"`, **When** o cliente chama `POST /chat`, **Then** vale o override já existente: o modelo do roteador não é chamado e o evento `route` tem `route: "team"`, `override: true` e o motivo estável de override.
4. **Given** um supervisor que nunca devolve `fim`, **When** o turno roda, **Then** o trace tem exatamente 8 eventos `handoff`, o oitavo papel ainda executa, não há nono handoff e a `answer` é `Execução interrompida: limite de iterações (8) atingido.`
5. **Given** o supervisor devolvendo `fim` no handoff de número 8, **When** o turno termina, **Then** a `answer` é esse `brief` e a mensagem de limite não substitui o encerramento.
6. **Given** `strategy` com um nome que não é `react`, `planExecute`, `reflect` nem `team`, **When** o cliente chama `POST /chat`, **Then** a resposta continua `422` e nenhum modo executa.

---

### Edge Cases

- `next` fora de `analista` | `planejador` | `executor` | `fim`, ou `brief` vazio ou só com espaços: o turno falha como erro de saída de modelo já traduzido na borda, sem escolher `analista` em silêncio e sem executar papel nenhum nessa decisão.
- O mesmo papel pode ser escolhido de novo em handoffs seguintes, até o teto de 8. Cada escolha gera o seu `handoff` e só então o papel roda.
- Handoff `fim` não executa papel. A `answer` é o `brief` aparado.
- Quadro de um turno não atravessa para o turno seguinte. O que permanece é o trace já persistido do pedido, incluindo os `handoff`.
- `strategy` ausente continua significando “roteador decide”. String vazia, só espaços ou tipo inválido continua `400`.
- `reflect: true` continua restringindo o roteador às bases `react` e `planExecute`. `team` não é base e não é embrulhado pela camada de reflexão. `strategy: "team"` ainda seleciona o modo equipe por override.
- Timeout de 180s, corpo inválido e os demais códigos HTTP do chat permanecem os atuais.
- "ver raciocínio" com `trace` vazio continua explicando que não há eventos. Um `handoff` com `brief` longo mostra o texto inteiro, sem novo pedido.
- O executor não cria fluxo novo de aprovação. Esta feature não define quando um incidente passa a responder `202`; ela só impede um atalho que grave incidente fora das duas ferramentas já validadas.
- Saída inválida do roteador, inclusive um `route` que não seja uma das quatro rotas, continua erro de saída de modelo, sem fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O modo equipe MUST viver em `src/team/` e MUST ser a quarta rota de produção, com id `team`, no grafo único já existente: contexto → roteador → exatamente uma rota → resposta. Com a rota `team`, só esse modo executa.
- **FR-002**: O supervisor MUST decidir com saída estruturada `withStructuredOutput` de campos `next` e `brief`. `next` MUST ser `analista`, `planejador`, `executor` ou `fim`. `brief` MUST ser texto não vazio depois de aparar espaços.
- **FR-003**: A decisão do supervisor MUST se apoiar no blackboard guardado no estado do turno. O quadro começa vazio e MUST ser a única memória compartilhada entre os papéis nesse turno. O supervisor MUST ser o único a escolher o próximo papel.
- **FR-004**: Cada decisão do supervisor MUST acrescentar ao quadro o `brief` e MUST emitir um evento de trace `type: "handoff"` com `next`, `brief` e `node: "supervisor"` antes de o papel correspondente rodar. `fim` emite o handoff e não roda papel.
- **FR-005**: O analista MUST receber somente ferramentas de leitura: `list_alerts`, `list_incidents`, `consultar_runbook` e `check_provider_status`. A única escrita dele no quadro MUST ser achados. Ele MUST NOT escrever o plano nem uma ação de incidente.
- **FR-006**: O planejador MUST receber lista vazia de ferramentas. A única escrita dele no quadro MUST ser o plano.
- **FR-007**: O executor MUST receber somente `open_incident` e `resolve_incident`, as mesmas ferramentas já usadas pelo copilot, com a mesma validação de argumentos. Ele MUST NOT consultar pelas ferramentas de leitura, MUST NOT gravar incidente por acesso direto ao store e MUST NOT expor parâmetro que dispense essa validação. Sem handoff `executor`, o turno MUST NOT abrir nem resolver incidente.
- **FR-008**: Um turno `team` MUST aceitar no máximo 8 handoffs. Se o oitavo `next` for um papel, esse papel roda e a `answer` MUST ser `Execução interrompida: limite de iterações (8) atingido.`, sem nono handoff. Se o oitavo `next` for `fim`, a `answer` MUST ser o `brief`. Se `fim` ocorrer antes, a `answer` MUST ser o `brief` e o turno para.
- **FR-009**: Saída do supervisor sem `next`/`brief` válidos MUST falhar como erro de saída de modelo já existente, sem fallback de papel.
- **FR-010**: O prompt do roteador MUST incluir `team` na tabela de rotas, com o critério da seção Assumptions. `strategy` omitida com o roteador escolhendo `team` MUST gravar `route` com `override: false`. `strategy: "team"` MUST ser override, sem chamar o modelo do roteador, com o motivo estável já usado nas outras rotas.
- **FR-011**: Nome de estratégia fora de `react`, `planExecute`, `reflect` e `team` MUST continuar respondendo `422`, sem executar modo algum.
- **FR-012**: "ver raciocínio" MUST renderizar o evento `handoff` com os campos `next` e `brief`, na ordem do `trace`, reutilizando o painel atual. Fechar o painel MUST NOT chamar o chat de novo. O formatador textual do trace MUST mostrar `next` e `brief` nesse evento.
- **FR-013**: Todo evento de trace do turno MUST continuar trazendo `node`. Handoffs usam `supervisor`. Eventos produzidos por um papel usam `analista`, `planejador` ou `executor`.
- **FR-014**: Testes automatizados MUST cobrir, sem rede: ordem supervisor e papéis com quadro acumulado; exclusividade da rota `team`; allowlist de ferramentas e campos do quadro por papel; ausência de escrita de incidente sem handoff `executor`; evento `handoff` com `next`, `brief` e `node`; renderização em "ver raciocínio"; teto de 8 com e sem `fim` no oitavo; `team` na tabela do roteador; override; `strategy` desconhecida → `422`; saída inválida do supervisor sem fallback.

### Key Entities

- **Blackboard**: quadro do turno no estado do modo equipe. Começa vazio. Guarda achados (analista), plano (planejador), ações de incidente (executor) e os recados já emitidos pelo supervisor. Não é persistido como registro próprio; o turno seguinte começa com outro quadro.
- **SupervisorDecision**: saída estruturada do supervisor — `next` (`analista` | `planejador` | `executor` | `fim`) e `brief` (texto não vazio).
- **Handoff**: evento de trace `type: "handoff"` com `next`, `brief` e `node: "supervisor"`. Um por decisão do supervisor, no máximo 8 por turno.
- **Papel**: `analista`, `planejador` ou `executor`. Só roda se o handoff imediatamente anterior o nomear. Escreve apenas o seu campo no quadro e só com as ferramentas da sua allowlist.
- **Rota `team`**: quarta rota de produção, ao lado de `react`, `planExecute` e `reflect`. Pode vir do roteador ou de `strategy`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turnos de teste com rota `team` e supervisor encerrando em `fim`, a resposta do chat é o recado de encerramento e os outros três modos tiveram zero execuções.
- **SC-002**: Em 100% dos turnos de teste, cada papel só aparece depois do handoff que o nomeia, e o quadro visto por ele já contém o que os papéis anteriores escreveram naquele turno.
- **SC-003**: Em 100% das montagens de papel exercitadas nos testes, o analista só tem as quatro ferramentas de leitura, o planejador tem zero ferramentas e o executor só tem `open_incident` e `resolve_incident`.
- **SC-004**: Em 100% dos turnos de teste em que o supervisor não escolhe o executor, o número de incidentes abertos ou resolvidos por esse turno é zero.
- **SC-005**: Em 100% dos turnos de teste com pelo menos uma decisão do supervisor, o trace devolve um `handoff` por decisão, e "ver raciocínio" mostra `next` e `brief` de cada um na mesma ordem, sem pedido extra ao chat.
- **SC-006**: Em 100% dos turnos de teste cujo supervisor não encerra, o trace tem 8 handoffs e a resposta é a mensagem de limite de 8 iterações. Quando o oitavo handoff encerra, a resposta é o recado e não a mensagem de limite.
- **SC-007**: Em 100% dos turnos de teste com `strategy: "team"`, o modelo do roteador é chamado zero vezes. Com `strategy` omitida e rota injetada `team`, o evento `route` marca override falso. `strategy` desconhecida continua `422` em 100% desses pedidos.

## Assumptions

- Typo do pedido (`withSctructuredOutput`) normalizado para `withStructuredOutput`.
- `next: "fim"` é o encerramento. O `brief` desse handoff, já aparado, é a `answer`. Não há quinto papel.
- Teto 8 conta handoffs do supervisor no turno, não itens do quadro nem chamadas de ferramenta. O oitavo handoff para um papel ainda executa esse papel; não há nona decisão. A frase de limite é a já usada por `react` e `planExecute`: `Execução interrompida: limite de iterações (8) atingido.`
- Linha nova da tabela do roteador (redação fina pode ajustar no plano desde que a rota e o critério permaneçam):

  | route | quando usar |
  |-------|-------------|
  | team | o pedido precisa ler a situação, propor um plano e agir em incidente, com papéis separados |

  As linhas já existentes de `react`, `planExecute` e `reflect` permanecem.
- Achados, plano e ações são campos distintos do blackboard. "Não propõe" significa que o analista não é autor do plano nem de uma ação de incidente; o texto que ele produz só entra em achados.
- "Sem bypass" significa que o executor não tem atalho: as únicas mutações de incidente são `open_incident` e `resolve_incident` já existentes, com a validação atual, e somente após handoff `executor`. Esta feature não introduz nem remove o cartão `202` de aprovação.
- Ferramentas de leitura do analista são as quatro já existentes citadas em FR-005. Memória, esquecimento e as ferramentas de incidente ficam de fora da allowlist dele.
- O quadro não é tabela nova no SQLite. O trace do pedido, já persistido, inclui os handoffs.
- `node` dos handoffs é `supervisor`. Eventos de papel usam o id do papel. O evento `route` continua com `node: "roteador"`.
- Motivo estável de override permanece `estratégia informada pelo cliente`.
- `reflect: true` não passa a oferecer nem a embrulhar `team`.
- O diretório `src/team/` é invariante do pedido. Nomes de arquivo dentro dele e o encaixe no grafo de produção ficam para `/speckit-plan`.
- Arena e CLI que invocam um modo direto ficam fora do escopo, exceto o formatador textual do trace, que passa a exibir `handoff`.
