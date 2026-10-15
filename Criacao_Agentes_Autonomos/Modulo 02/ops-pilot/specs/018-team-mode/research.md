# Research: Modo equipe

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

## R1. Onde o modo vive e como entra no chat

- **Decision**: A rota de produção `team` é um nó a mais no `StateGraph` já existente em `src/graph/production-Graph.ts` (`context` → `roteador` → uma rota → `resposta`). A implementação do modo fica em `src/team/` e se expõe como `ReasoningStrategy` de nome `team`. `PRODUCTION_ROUTES` passa a ser `react`, `planExecute`, `reflect`, `team`. O `422` de estratégia desconhecida continua na borda HTTP, que já compara o nome com `PRODUCTION_ROUTES`.
- **Rationale**: A spec pede o diretório `src/team/` e a rota `team` no mesmo chat. O grafo de produção já escolhe uma estratégia e devolve `{ answer, trace, metrics }`. Um segundo servidor ou um caminho paralelo em `runChat` furaria o grafo único.
- **Alternatives considered**: Supervisor como nó irmão de `roteador` no grafo de produção (mistura o quadro da equipe com o estado do chat e obriga todo turno a carregar blackboard); chamar os três papéis em série fixa dentro de `runChat` (a spec pede o supervisor escolhendo `next`).

## R2. Topologia do grafo da equipe e teto 8

- **Decision**: `StateGraph` próprio, compilado a cada `run`. Nós: `supervisor`, `analista`, `planejador`, `executor`, `limite`. Arestas: `START` → `supervisor`. Depois do supervisor, `fim` vai a `END`; qualquer papel vai ao nó desse papel. Depois do papel, se `handoffs < 8` volta ao `supervisor`; se `handoffs === 8` vai a `limite` e depois `END`. O nó `limite` fixa a answer `Execução interrompida: limite de iterações (8) atingido.` O handoff de número 8 para um papel ainda executa esse papel. `fim` no oitavo handoff encerra no supervisor, sem passar por `limite`.
- **Rationale**: A spec conta handoffs, não chamadas de ferramenta, e distingue o oitavo `fim` da mensagem de limite. O papel do oitavo handoff precisa rodar antes do encerramento forçado. Um `recursionLimit` solto do LangGraph não distingue essas duas saídas.
- **Alternatives considered**: Reusar `createReactAgent` com `recursionLimit: 16` (não há papéis nem `handoff`); contar 8 chamadas de modelo somando papéis e supervisor (a spec conta handoffs; o oitavo papel ainda roda).

## R3. Supervisor e saída estruturada

- **Decision**: Zod `supervisorSchema` com `next` enum `analista | planejador | executor | fim` e `brief` string. Produção usa `createModel().withStructuredOutput(supervisorSchema, { method: "functionCalling" })`, com uma retentativa, no mesmo padrão do roteador. `brief` aparado vazio, `next` ausente ou fora do enum lança `ModelOutputError` com o passo `"supervisor"` e não executa papel. O modelo é injetável (`invoke(messages) → { next, brief }`) para os testes não abrirem rede. O prompt de sistema descreve os três papéis e os limites (leitura sem proposta, sem ferramentas, só incidente). A mensagem de usuário leva a mensagem do plantonista e o JSON do blackboard.
- **Rationale**: A spec exige `withStructuredOutput({ next, brief })` e o mesmo erro de saída de modelo já traduzido na borda. Injetar o supervisor espelha o `routeModel` do grafo de produção.
- **Alternatives considered**: Classificar `next` com texto livre (não é saída estruturada e cai em fallback silencioso); deixar o papel decidir o sucessor (a spec reserva isso ao supervisor).

## R4. Blackboard no estado do turno

- **Decision**: Objeto no estado do grafo da equipe, não tabela SQLite. Campos: `findings` (string, o analista acrescenta), `plan` (string, o planejador substitui), `actions` (lista de `{ tool, args, observation }`, o executor acrescenta), `briefs` (lista de `{ next, brief }` na ordem dos handoffs). Estado inicial: strings vazias e listas vazias. Atualização em funções puras. O turno seguinte não recebe esse objeto; o que fica é o `trace` já gravado por `runChat`.
- **Rationale**: A spec pede o quadro no estado e proíbe registro próprio. Substituir o plano deixa o executor com a última versão. Acrescentar achados e ações preserva o que os papéis anteriores escreveram quando o mesmo papel volta.
- **Alternatives considered**: Uma lista única de notas sem autor (não dá para testar “o analista não escreve o plano”); persistir o quadro em `ops_request` (a spec limita a persistência ao trace).

## R5. Allowlist e uma rodada de ferramenta

- **Decision**: Função pura `toolsFor(role, tools)` filtra a lista que o turno já recebeu (`options.tools` ou, na ausência, `createDefaultOpsTools()`). Analista: `list_alerts`, `list_incidents`, `consultar_runbook`, `check_provider_status`. Planejador: lista vazia. Executor: `open_incident`, `resolve_incident`. `forget_preference` e qualquer outro nome ficam de fora das três. Cada visita de analista ou executor faz no máximo uma rodada: o modelo vê só a lista filtrada; cada `tool_call` só executa se o nome estiver nessa lista, via `tool.invoke`; nome fora dela lança `ModelOutputError` e não procura a ferramenta na lista original. O planejador não recebe `bindTools`; a saída dele é estruturada `{ plan: string }` não vazia. `src/team/` não importa `OpsStore`.
- **Rationale**: A spec exige as ferramentas já existentes, sem atalho de store e sem o executor herdar leitura ou memória. Uma rodada por handoff impede um ReAct interno com outro teto 8. O `202` de aprovação continua fora desta feature: as tools atuais já devolvem JSON, e o executor não ganha parâmetro para pular a validação Zod delas.
- **Alternatives considered**: `createReactAgent` por papel com o teto 8 de novo (estoura o turno e mistura handoff com iteração); o executor importar `executeOpenIncident` direto (bypass do objeto tool que o restante do copilot usa); incluir `list_incidents` no executor (leitura é do analista).

## R6. Eventos de trace e carimbo `node`

- **Decision**: Nova variante `handoff` em `TraceEvent`: `{ type: "handoff", next, brief, node: "supervisor" }`, emitida no nó supervisor antes do papel. Achados do analista viram `thought`. Chamadas e retornos viram `action` e `observation`. O plano vira `plan` com `steps` obtidos quebrando `plan` em linhas não vazias (uma linha se não houver quebra). O encerramento e o limite acrescentam `answer`. Papéis carimbam o próprio `node` (`analista`, `planejador`, `executor`). No grafo de produção, a rota `team` não passa por `stampTraceNode` das bases: evento que já tem `node` permanece; evento sem `node` recebe `team`. `formatTrace` ganha `[handoff] <next> <brief>`. `presentTrace` mostra as linhas `next` e `brief`.
- **Rationale**: `stampTraceNode` hoje reescreve todo evento que não é `route` com a base (`react` ou `planExecute`). Aplicado ao `team`, apagaria `supervisor` e os papéis. "ver raciocínio" já é `presentTrace`; o painel não precisa de componente novo.
- **Alternatives considered**: Um único `thought` com o brief (a spec pede o tipo `handoff`); renderizar `handoff` pelo ramo de tipo desconhecido (mostraria o JSON inteiro, não os campos `next` e `brief`).

## R7. Reflexão, métricas e erros

- **Decision**: `reflect: true` continua limitando o roteador a `react` e `planExecute`. O nó de estratégia não embrulha `team` com `withReflection`, mesmo se o corpo trouxer `strategy: "team"` e `reflect: true`. Métricas do modo (`llmCalls`, `promptTokens`) somam supervisor e papéis via `createLlmCallCounter` e sobem pelo retorno da strategy, como nas outras rotas; o nó `resposta` continua somando o roteador. `ModelUnavailableError` propaga. Não há `collectFallbacks` interno: o `runChat` já envolve o grafo de produção.
- **Rationale**: A spec diz que `team` não é base e não é embrulhado. Um segundo coletor de fallback duplicaria eventos `fallback` no trace do chat.
- **Alternatives considered**: Tratar `team` como base refletível (contradiz a spec); zerar métricas do supervisor (o plantonista perderia as chamadas da equipe na métrica do turno).

## R8. Fakes nos testes já existentes

- **Decision**: Todo objeto `strategies` tipado como `Record<ProductionRoute, ReasoningStrategy>` ganha a chave `team`. O teste que fixa `PRODUCTION_ROUTES` em três nomes passa a esperar os quatro. O prompt do roteador ganha a linha `team` com o critério da spec, sem remover as três linhas atuais. `strategy: "team"` no HTTP usa o fake dessa chave e não chama o `routeModel`.
- **Rationale**: O enum da rota é a fonte do `422` e do tipo do mapa. Sem a chave, o typecheck quebra nos testes do grafo e do servidor.
- **Alternatives considered**: Deixar `team` só no default de produção e `Partial` no mapa de teste (o teste de “só a rota devolvida” deixaria de percorrer `team`).
