# Feature Specification: Orçamento de contexto por seção

**Feature Branch**: `012-context-section-budget`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "ContextBulder com orçamento por seção: src/context/context-builder.ts monta o prompt de TODAS as estrátegias com teto por seção via env CONTEXT_BUDGET_*: system e messagem intocáveis, resumo 200, janela 1200 (corta as mais antigas), memórias 300 (corta menor score). Teste: tetos baixos cortam na ordem certa"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Montar o contexto com teto por seção (Priority: P1)

Antes de qualquer estratégia de raciocínio rodar, o OpsPilot monta o contexto do turn a partir das seções disponíveis (instruções de sistema, mensagem atual, resumo da conversa, janela de histórico e memórias recuperadas). Cada seção cortável respeita um teto de tamanho configurável. As seções intocáveis (sistema e mensagem atual) entram sempre por completo. Assim, plantões longos e recalls ricos não estouram o contexto de forma descontrolada, e todas as estratégias recebem o mesmo contexto já orçado.

**Why this priority**: É o valor mínimo da feature — um único montador compartilhável que aplica orçamento e alimenta todas as estratégias.

**Independent Test**: Com entradas conhecidas (system, mensagem, resumo, histórico, memórias com scores) e tetos nos valores padrão, montar o contexto e verificar: (a) system e mensagem presentes integralmente; (b) resumo, janela e memórias dentro dos tetos; (c) o mesmo resultado é o que as estratégias consomem (não um prompt paralelo sem orçamento).

**Acceptance Scenarios**:

1. **Given** system, mensagem, resumo, histórico e memórias dentro dos tetos padrão, **When** o contexto é montado, **Then** todas as seções presentes entram sem corte e o resultado é o contexto usado por qualquer estratégia do turn.
2. **Given** system e mensagem de qualquer tamanho, **When** o contexto é montado, **Then** system e mensagem aparecem por completo — nunca truncados pelo orçamento.
3. **Given** as estratégias disponíveis no OpsPilot (todas), **When** um turn monta contexto, **Then** nenhuma estratégia recebe histórico/resumo/memórias “crus” sem passar pelo montador com orçamento.

---

### User Story 2 - Cortar na ordem certa quando o teto estoura (Priority: P2)

Quando uma seção cortável ultrapassa o teto, o montador remove conteúdo na ordem definida: na janela de histórico, as mensagens mais antigas saem primeiro; nas memórias, as de menor score saem primeiro; no resumo, o texto é reduzido até caber no teto. Com tetos baixos de teste, o corte é determinístico e verificável.

**Why this priority**: O orçamento só é confiável se a política de corte for explícita e testável. Depende do montador P1 existir.

**Independent Test**: Fixar tetos artificialmente baixos e entradas que excedem cada teto; assertar quais itens sobrevivem (histórico: as mais recentes; memórias: as de maior score; resumo: texto dentro do teto) e que system/mensagem permanecem intactos.

**Acceptance Scenarios**:

1. **Given** um histórico cuja estimativa de tokens ultrapassa o teto da janela, **When** o contexto é montado, **Then** as mensagens mais antigas são removidas até a janela caber; as mais recentes permanecem.
2. **Given** memórias com scores distintos cuja estimativa ultrapassa o teto de memórias, **When** o contexto é montado, **Then** as de menor score são removidas primeiro até caber; empates de score seguem a regra documentada nas Assumptions.
3. **Given** um resumo cuja estimativa ultrapassa o teto de resumo, **When** o contexto é montado, **Then** o resumo injetado cabe no teto e system/mensagem não são alterados.
4. **Given** tetos baixos que forçam corte em mais de uma seção ao mesmo tempo, **When** o contexto é montado, **Then** cada seção é cortada só pela própria política (janela ≠ memórias ≠ resumo); o corte de uma não reescreve a política da outra.

---

### User Story 3 - Configurar tetos por ambiente sem rede (Priority: P3)

Quem opera ou testa o OpsPilot ajusta os tetos das seções cortáveis via variáveis de ambiente `CONTEXT_BUDGET_*`, com padrões: resumo 200, janela 1200, memórias 300 (unidades = estimativa de tokens já usada no projeto). A suíte cobre o comportamento com tetos baixos, sem chamar o modelo.

**Why this priority**: Operabilidade e regressão; não entrega sozinha o valor de plantão.

**Independent Test**: Sem rede, sobrescrever `CONTEXT_BUDGET_*` com valores baixos, montar contexto com entradas que excedem esses valores e assertar a ordem de corte. Com variáveis ausentes, os padrões 200 / 1200 / 300 valem.

**Acceptance Scenarios**:

1. **Given** `CONTEXT_BUDGET_*` ausentes, **When** o montador sobe, **Then** usa resumo=200, janela=1200, memórias=300.
2. **Given** `CONTEXT_BUDGET_*` com valores baixos conhecidos, **When** o montador aplica o orçamento, **Then** os cortes respeitam esses valores (não os padrões).
3. **Given** a suíte de testes do montador, **When** ela executa, **Then** passa sem rede e cobre pelo menos: seções intocáveis; corte de janela (mais antigas); corte de memórias (menor score); resumo dentro do teto; padrões quando env ausente.

---

### Edge Cases

- Seção cortável vazia ou ausente: não entra no prompt; contribui 0 para o teto daquela seção.
- Histórico com uma única mensagem que sozinha ultrapassa o teto da janela: remove a mais antiga disponível; se após remover tudo ainda não couber uma mensagem individual, essa mensagem não entra na janela orçada (system/mensagem continuam intocáveis).
- Empate de score entre memórias: remove primeiro a de menor prioridade estável (menor score; em empate, a que aparece por último na lista de recall ordenada — a de pior ranking).
- Resumo exatamente no teto: entra sem corte.
- Valor de env não numérico, ≤ 0 ou inválido: tratar como ausente e cair no padrão da seção (não falhar o turn só por env ruim).
- System ou mensagem enormes: entram inteiros mesmo que o total do prompt fique grande; o orçamento não os corta (trade-off explícito).
- Métricas `contextBreakdown` / `historyMessages` / `recalledMemories`: devem refletir o que de fato foi injetado após o orçamento (não o material bruto antes do corte).
- Estratégias que hoje formatam prompt localmente: passam a consumir o resultado do montador; não há caminho paralelo sem orçamento.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST montar o contexto de cada turn em `src/context/context-builder.ts` (ContextBuilder), único ponto usado por **todas** as estratégias antes da execução.
- **FR-002**: O montador MUST considerar as seções: system (instruções de sistema), message (mensagem atual), summary (resumo da conversa), window (janela de histórico) e memories (memórias recuperadas).
- **FR-003**: As seções **system** e **message** MUST ser intocáveis: o orçamento MUST NOT truncá-las nem omiti-las quando presentes.
- **FR-004**: O teto padrão de **summary** MUST ser **200** (estimativa de tokens); se a estimativa do resumo ultrapassar o teto, o texto injetado MUST ser reduzido até caber.
- **FR-005**: O teto padrão de **window** MUST ser **1200**; se a janela ultrapassar o teto, o sistema MUST remover as mensagens **mais antigas** primeiro até caber.
- **FR-006**: O teto padrão de **memories** MUST ser **300**; se as memórias ultrapassarem o teto, o sistema MUST remover as de **menor score** primeiro até caber.
- **FR-007**: Os tetos das seções cortáveis MUST ser configuráveis via variáveis de ambiente `CONTEXT_BUDGET_*` (no mínimo summary, window e memories), lidas na composição/startup conforme o padrão do projeto (sem dotenv).
- **FR-008**: A unidade dos tetos MUST ser a mesma estimativa de tokens já usada no OpsPilot (`floor(caracteres / 4)` sobre o conteúdo da seção / de cada item).
- **FR-009**: Após o orçamento, o contexto montado MUST ser o que todas as estratégias recebem; MUST NOT existir caminho de produção que injete histórico/resumo/memórias sem passar pelo montador.
- **FR-010**: Contagens e partição de contexto expostas no turn (`historyMessages`, `recalledMemories`, `contextBreakdown`) MUST refletir o material **após** o corte por orçamento.
- **FR-011**: Testes automatizados MUST cobrir, sem rede: (a) system e message intactos sob tetos baixos; (b) janela corta as mais antigas; (c) memórias cortam menor score; (d) resumo cabe no teto; (e) padrões 200/1200/300 quando env ausente; (f) env baixo sobrescreve o padrão.

### Key Entities

- **ContextSection**: uma fatia nomeada do prompt (`system`, `message`, `summary`, `window`, `memories`).
- **SectionBudget**: teto ≥ 1 (após validação) em tokens estimados para uma seção cortável; origem = env `CONTEXT_BUDGET_*` ou padrão.
- **BudgetedContext**: resultado do montador — seções já orçadas prontas para qualquer estratégia.
- **MemoryCandidate**: fato recuperado com `score`; candidato a corte por menor score.
- **HistoryMessage**: mensagem da janela com ordem temporal; candidata a corte pela mais antiga.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turns de teste, system e mensagem presentes entram por completo, independentemente dos tetos das outras seções.
- **SC-002**: Em 100% dos casos de teste com janela acima do teto, só sobram mensagens suficientes para a estimativa ≤ teto, e as sobreviventes são as mais recentes.
- **SC-003**: Em 100% dos casos de teste com memórias acima do teto, só sobram fatos suficientes para a estimativa ≤ teto, e os sobreviventes são os de maior score.
- **SC-004**: Em 100% dos casos de teste com resumo acima do teto, o resumo injetado tem estimativa ≤ teto.
- **SC-005**: Com env ausente, 100% das montagens de teste usam tetos 200 (resumo), 1200 (janela) e 300 (memórias).
- **SC-006**: Em 100% das estratégias exercitadas nos testes de integração do chat, o material de histórico/resumo/memórias injetado coincide com a saída do montador (sem bypass).
- **SC-007**: A suíte do montador com tetos baixos conclui sem rede e falha se a ordem de corte estiver invertida.

## Assumptions

- Typo do pedido (`ContextBulder`, `estrátegias`, `messagem`) normalizado para ContextBuilder, estratégias e mensagem.
- `CONTEXT_BUDGET_*` cobre pelo menos `CONTEXT_BUDGET_SUMMARY`, `CONTEXT_BUDGET_WINDOW` e `CONTEXT_BUDGET_MEMORIES`. System e message não têm teto configurável nesta feature (intocáveis).
- Unidade = `estimateTokens` já existente (`floor(chars/4)`). Para a janela, a estimativa é a soma do conteúdo das mensagens mantidas (rótulos de papel fora da conta, alinhado à partição atual). Para memórias, soma dos fatos mantidos. Para resumo, estimativa do texto injetado.
- Corte do resumo: reduzir o texto (manter o prefixo / início) até `estimateTokens(texto) ≤ teto`; detalhe fino de encoding no plano.
- Empate de score: remove primeiro o candidato de pior ranking na lista já ordenada por recall (último entre os empatados).
- Uma mensagem ou um fato individual maior que o teto da seção: não entra; o montador não “parte” a mensagem/fato no meio além da regra de prefixo do resumo.
- O montador em `src/context/context-builder.ts` é invariante do pedido; pode substituir ou encapsular a composição atual (`compose-chat-prompt` / formatação por estratégia) — decisão de wiring em `/speckit-plan`.
- Janela de **contagem** de mensagens (ex.: 8 recentes da feature 011) continua a valer antes do orçamento por tokens: o orçamento corta ainda mais se a estimativa da janela já limitada ultrapassar o teto.
- Recall deve expor `score` ao montador (hoje `runChat` só mapeia `fact`); o plano liga score ao builder sem mudar o contrato HTTP externo.
- Autenticação, UI de ajuste de tetos, orçamento global único (soma de todas as seções) e corte de system/message ficam fora de escopo.
- Contratos HTTP, `strategy`, `reflect`, pruning/resumo e códigos de erro existentes permanecem válidos; esta feature só altera o que entra no prompt após as fontes já resolvidas.
