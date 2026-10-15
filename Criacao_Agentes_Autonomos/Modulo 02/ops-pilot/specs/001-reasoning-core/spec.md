# Feature Specification: Núcleo de Raciocínio do OpsPilot

**Feature Branch**: `001-reasoning-core`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Núcleo de raciocínio do OpsPilot: interface ReasoningStrategy (name + run(input) -> answer, trace, metrics) com trace de eventos tipados e métricas; fábrica única de modelo lendo OPENROUTER_API_KEY e OPENROUTER_MODEL com temperature 0; ferramentas mock sobre store pré-populado (seed: 5 serviços, 6 alertas — 3 firing, 3 resolved) com list_alerts, open_incident e resolve_incident; estratégias ReAct e Plan-and-Execute (máx. 8 passos) com limite de iterações e contagem de chamadas de LLM; arena mínima rodando 1+ estratégias sobre o mesmo input imprimindo traces e métricas (flags --strategies e --max-iterations); testes determinísticos de store e formatação de traces, sem rede."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comparar estratégias de raciocínio na arena (Priority: P1)

Um desenvolvedor do OpsPilot executa a arena pela linha de comando com uma pergunta sobre alertas de produção e uma lista de estratégias. Para cada estratégia selecionada, a arena executa o mesmo input e imprime a resposta final, o trace completo de raciocínio e as métricas (chamadas ao modelo e latência), permitindo comparar como cada estratégia resolveu o mesmo problema.

**Why this priority**: É o valor central do núcleo: sem um comparador executável de estratégias, as estratégias individuais não entregam nada observável ao usuário. É o MVP demonstrável.

**Independent Test**: Executar `npm run arena -- --strategies react --max-iterations 4` sobre o catálogo semeado e verificar que a saída contém resposta, trace tipado e métricas para a estratégia escolhida.

**Acceptance Scenarios**:

1. **Given** o ambiente configurado com credenciais do provedor de modelo e o seed carregado, **When** o usuário roda a arena com `--strategies react`, **Then** a saída mostra resposta final, trace de eventos tipados na ordem de execução e métricas de chamadas ao modelo e latência daquela estratégia.
2. **Given** duas estratégias solicitadas (`react` e `plan-and-execute`), **When** a arena roda o mesmo input, **Then** ambas recebem exatamente o mesmo input e a saída separa claramente o resultado de cada estratégia pelo seu nome.
3. **Given** `--max-iterations 2`, **When** a estratégia excede 2 iterações, **Then** a execução para no limite e a saída indica que o limite foi atingido, sem travar.

---

### User Story 2 - Ferramentas operacionais sobre o catálogo de alertas (Priority: P2)

Um agente (ou desenvolvedor) consulta alertas filtrando por status, abre um incidente a partir de título/serviço/severidade e resolve um incidente existente. As operações partem de um catálogo semeado de 5 serviços e 6 alertas (3 em disparo, 3 resolvidos) e persistem as mudanças de estado de forma consistente entre execuções.

**Why this priority**: Sem ferramentas funcionais, nenhuma estratégia tem o que executar; mas a arena pode ser demonstrada com uma estratégia simples antes de todas as ferramentas estarem completas.

**Independent Test**: Rodar o script de seed e os testes de store (sem rede) validando: listagem filtrada por status, abertura de incidente vinculada a serviço válido e resolução de incidente existente — incluindo rejeição de entradas inválidas.

**Acceptance Scenarios**:

1. **Given** o seed executado, **When** se lista alertas com status `firing`, **Then** exatamente os 3 alertas em disparo são retornados; com status `resolved`, os 3 resolvidos.
2. **Given** um alerta em disparo sobre um serviço conhecido, **When** se abre um incidente com título, serviço e severidade válidos, **Then** o incidente é criado com identificador único e passa a existir no store.
3. **Given** um incidente aberto, **When** se resolve pelo identificador, **Then** o incidente fica marcado como resolvido; resolver um identificador inexistente retorna erro de domínio.
4. **Given** entradas inválidas (severidade fora do conjunto permitido, serviço inexistente, identificador malformado), **When** qualquer ferramenta é chamada, **Then** a entrada é rejeitada com erro claro antes de tocar o domínio.

---

### User Story 3 - Observabilidade uniforme do raciocínio (Priority: P3)

Ao executar qualquer estratégia, o desenvolvedor obtém um trace de eventos tipados (pensamento, ação com ferramenta e argumentos, observação, plano, crítica, resposta) e métricas padronizadas (número de chamadas ao modelo, latência total), independentemente da estratégia usada, podendo serializar e comparar traces entre execuções.

**Why this priority**: O formato uniforme de trace/métricas é o que torna as estratégias comparáveis e testáveis; pode ser validado com testes determinísticos antes mesmo das estratégias avançadas.

**Independent Test**: Testes determinísticos sem rede que constroem traces artificiais e validam a formatação/serialização estável do trace e o cálculo das métricas.

**Acceptance Scenarios**:

1. **Given** uma execução qualquer, **When** o trace é produzido, **Then** cada evento pertence a um tipo conhecido e eventos de ação carregam ferramenta e argumentos.
2. **Given** duas estratégias diferentes sobre o mesmo input, **When** as métricas são impressas, **Then** ambas reportam chamadas ao modelo e latência nos mesmos campos.
3. **Given** a contagem de chamadas ao modelo, **When** uma estratégia executa N chamadas ao modelo, **Then** a métrica reporta exatamente N.

---

### Edge Cases

- Credenciais do provedor de modelo ausentes ou vazias: a fábrica de modelo falha com mensagem clara antes de qualquer chamada de rede.
- Modelo indisponível ou erro do provedor durante uma execução: a estratégia reporta a falha sem corromper o trace parcial.
- Limite de iterações atingido (geral ou os 8 passos do planejador): a execução encerra de forma controlada e registra no trace que o limite foi atingido.
- Ferramenta chamada com argumentos inválidos pelo agente: a rejeição ocorre na fronteira e volta como observação de erro para o trace, sem quebrar a execução.
- Seed executado mais de uma vez: comportamento idempotente ou reexecução limpa, sem duplicar o catálogo.
- Arena chamada sem estratégia ou com nome de estratégia desconhecido: erro claro com a lista de estratégias disponíveis.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST oferecer um contrato único de estratégia de raciocínio, identificado por nome, que receba um input textual e retorne resposta final, trace de raciocínio e métricas de execução.
- **FR-002**: O trace MUST ser uma sequência ordenada de eventos tipados (pensamento, ação, observação, plano, crítica, resposta), onde eventos de ação registram a ferramenta e seus argumentos.
- **FR-003**: As métricas MUST incluir, no mínimo, número de chamadas ao modelo e latência total da execução, produzidas por toda estratégia.
- **FR-004**: O sistema MUST ter uma fábrica única de modelo que exija as credenciais e o nome do modelo do provedor via configuração de ambiente, com temperatura determinística (0), e falhe com mensagem clara quando a configuração estiver ausente.
- **FR-005**: O sistema MUST disponibilizar as ferramentas operacionais: listar alertas com filtro opcional por status, abrir incidente (título, serviço, severidade) e resolver incidente por identificador.
- **FR-006**: Toda ferramenta MUST validar seus argumentos na fronteira e rejeitar entradas inválidas com erro compreensível ao chamador.
- **FR-007**: O sistema MUST persistir serviços, alertas e incidentes em banco relacional, com catálogo inicial reproduzível de 5 serviços e 6 alertas (3 em disparo, 3 resolvidos), instalável por script de seed executável de forma independente.
- **FR-008**: O sistema MUST fornecer a estratégia ReAct, capaz de intercalar raciocínio e chamadas de ferramentas até responder, com o trace completo capturado.
- **FR-009**: O sistema MUST fornecer a estratégia Plan-and-Execute: um planejador produz uma lista de passos, um executor executa um passo por vez com as ferramentas e um replanejador revisa os passos restantes após cada execução, encerrando quando não resta nada; o plano MUST ter no máximo 8 passos.
- **FR-010**: Toda estratégia MUST respeitar um limite de iterações configurável e encerrar de forma controlada ao atingi-lo.
- **FR-011**: A arena MUST executar uma ou mais estratégias selecionadas pelo usuário sobre o mesmo input e imprimir, para cada uma, nome, resposta, trace e métricas; aceita os parâmetros `--strategies` e `--max-iterations`.
- **FR-012**: O sistema MUST ter testes determinísticos, sem acesso à rede, cobrindo no mínimo o store de ferramentas e a formatação de traces.
- **FR-013**: Falhas previsíveis (configuração ausente, entrada inválida, identificador inexistente, limite atingido) MUST ser representadas como erros de domínio traduzidos na borda (CLI).

### Key Entities *(include if feature involves data)*

- **Serviço**: serviço de produção monitorado; identificador e nome. Relaciona-se com alertas e incidentes.
- **Alerta**: condição detectada em um serviço; status (`firing` ou `resolved`), descrição e vínculo com o serviço.
- **Incidente**: ocorrência aberta a partir de um alerta; título, serviço, severidade e estado (aberto/resolvido).
- **Evento de trace**: registro de raciocínio de uma execução; tipo, conteúdo e, para ações, ferramenta e argumentos; ordenado por sequência.
- **Resultado de estratégia**: resposta final, trace e métricas (chamadas ao modelo, latência) de uma execução.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário executa a arena do zero (seed + execução) e obtém o resultado de uma estratégia em menos de 5 minutos de setup, dado que possui credenciais válidas.
- **SC-002**: 100% das execuções de estratégia retornam trace tipado completo e métricas nos mesmos campos, permitindo comparação lado a lado.
- **SC-003**: A suíte de testes determinísticos (store e formatação de traces) roda em menos de 10 segundos sem nenhuma chamada de rede.
- **SC-004**: 100% das chamadas de ferramenta com argumentos inválidos são rejeitadas na fronteira, sem alteração de estado.
- **SC-005**: Nenhuma execução excede o limite de iterações configurado nem os 8 passos do planejador; ao atingir o limite, o encerramento controlado ocorre em 100% dos casos.
- **SC-006**: A contagem de chamadas ao modelo reportada corresponde exatamente ao número de chamadas efetuadas em 100% das execuções observadas.

## Assumptions

- O usuário possui credenciais válidas do provedor de modelo e as fornece via variáveis de ambiente; sem elas, apenas os testes determinísticos (sem rede) funcionam.
- O banco relacional local (MySQL) está disponível e acessível para o seed e para as ferramentas; credenciais do banco ficam fora do repositório.
- O catálogo semeado é apenas um ambiente de demonstração/avaliação; dados de produção reais estão fora de escopo nesta feature.
- A interface da arena é exclusivamente CLI; nenhuma interface HTTP é exposta nesta feature.
- As estratégias operam sobre um único input textual por execução; histórico multi-turno está fora de escopo.
- O conjunto de severidades e os tipos de evento de trace são fechados e definidos pelo sistema.
