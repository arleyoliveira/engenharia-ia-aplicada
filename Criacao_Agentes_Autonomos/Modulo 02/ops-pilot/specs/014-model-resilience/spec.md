# Feature Specification: Resiliência de modelo

**Feature Branch**: `014-model-resilience`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "Resiliência de modelo: .env: OPENROUTER_MODEL_FALLBACK; fábrica models.ts: withRetry no primário; withFallbacks([reserva]); Trace: evento \"fallback\"; metrics. Caso nada funcione, 503"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plantão segue quando o modelo primário falha (Priority: P1)

O plantonista envia um turn de chat. O modelo primário falha de forma transitória (rede, erro do provedor). O OpsPilot tenta de novo o primário antes de desistir. Se as tentativas se esgotam e há um modelo reserva configurado, a reserva responde e o plantonista recebe a resposta normalmente. Sem reserva configurada, só o primário é tentado.

**Why this priority**: É o valor da feature — uma falha passageira do modelo não precisa derrubar o plantão, e um segundo modelo cobre a indisponibilidade do primeiro.

**Independent Test**: Com modelos fake (sem rede), simular o primário falhando nas duas primeiras tentativas e respondendo na terceira: a resposta é sucesso e a reserva não é chamada. Simular o primário falhando nas três tentativas e a reserva respondendo: a resposta de sucesso é a da reserva.

**Acceptance Scenarios**:

1. **Given** o primário configurado e a reserva configurada, **When** o primário falha nas duas primeiras tentativas e responde na terceira, **Then** o turn conclui com sucesso, a reserva não é invocada e não há troca de modelo.
2. **Given** o primário e a reserva configurados, **When** o primário falha nas três tentativas e a reserva responde, **Then** o turn conclui com sucesso usando a resposta da reserva.
3. **Given** a reserva não configurada (variável ausente ou em branco), **When** o primário responde dentro das três tentativas, **Then** o turn conclui com sucesso e nenhum segundo modelo é chamado.
4. **Given** qualquer chamada de modelo de produção (roteamento, estratégia, reflexão, resumo ou aprendizado), **When** essa chamada executa, **Then** ela passa pela mesma cadeia resiliente da fábrica (retry no primário e, se houver, reserva).

---

### User Story 2 - Saber que a reserva assumiu (Priority: P2)

Quando a reserva atende uma chamada que o primário não conseguiu completar, o plantonista (ou o teste) vê isso no trace do turn e na métrica agregada. Turnos em que o primário bastou deixam a métrica em zero e não registram troca.

**Why this priority**: Sem o registro, uma resposta “normal” esconde que o modelo reserva entrou. A auditoria do plantão depende desse sinal. Depende da cadeia da US1.

**Independent Test**: No cenário em que a reserva responde, a resposta `200` contém um evento de trace `fallback` (modelo de origem e modelo de destino) e `metrics.fallbacks` igual ao número de chamadas atendidas pela reserva. No cenário em que o primário se recupera no retry, `metrics.fallbacks` é `0` e não há evento `fallback`.

**Acceptance Scenarios**:

1. **Given** uma chamada atendida pela reserva, **When** o cliente lê o turn `200`, **Then** o trace contém um evento `type: "fallback"` com o identificador do primário em `from` e o da reserva em `to`.
2. **Given** um turn com N chamadas de modelo atendidas pela reserva, **When** o cliente lê as métricas, **Then** `metrics.fallbacks` é N e há N eventos `fallback`, na ordem em que as trocas ocorreram.
3. **Given** um turn em que toda chamada foi atendida pelo primário (na primeira tentativa ou após retry), **When** o cliente lê a resposta `200`, **Then** `metrics.fallbacks` é `0` e o trace não contém evento `fallback`.

---

### User Story 3 - Indisponibilidade explícita quando nada responde (Priority: P3)

Se o primário esgota as tentativas e a reserva também falha — ou não existe reserva — o cliente não recebe sucesso nem um erro genérico de servidor. O chat responde indisponibilidade do modelo.

**Why this priority**: Falhar fechado e com status próprio evita tratar queda de provedor como defeito interno. Só faz sentido depois da política de retry e reserva.

**Independent Test**: Com fakes que sempre lançam, chamar o fluxo de chat com reserva configurada e sem reserva. Em ambos os casos o status é `503`, o código de erro é de modelo indisponível e o corpo não traz stack nem detalhe bruto do provedor. Timeout de borda continua `504`.

**Acceptance Scenarios**:

1. **Given** primário e reserva falhando em todas as tentativas previstas, **When** o cliente chama `POST /chat`, **Then** a resposta é `503` com erro de domínio de modelo indisponível e mensagem legível, sem sucesso parcial apresentado como `200`.
2. **Given** a reserva não configurada e o primário falhando nas três tentativas, **When** o cliente chama `POST /chat`, **Then** a resposta é `503` com o mesmo tipo de erro e a reserva não é chamada.
3. **Given** a execução estoura o timeout de borda já existente, **When** o cliente chama `POST /chat`, **Then** a resposta continua `504` (timeout), não `503`.
4. **Given** a mesma falha total fora do HTTP (CLI ou arena), **When** a execução termina, **Then** ela falha com o erro de domínio correspondente e não imprime uma resposta de sucesso.

---

### Edge Cases

- `OPENROUTER_MODEL_FALLBACK` ausente, vazia ou só espaços: equivale a “sem reserva”. A fábrica aplica retry só no primário e não chama `withFallbacks`.
- `OPENROUTER_API_KEY` ou `OPENROUTER_MODEL` ausentes: continua erro de configuração na subida da chamada, não `503` de indisponibilidade.
- Reserva com o mesmo identificador do primário: permitida; a troca ainda conta como fallback se o primário esgotar as tentativas. Escolher um modelo diferente é responsabilidade de quem configura.
- Várias chamadas de modelo no mesmo turn: cada chamada tem o próprio orçamento de 3 tentativas no primário. Uma chamada pode cair na reserva e outra não.
- Uma chamada posterior do mesmo turn esgota primário e reserva: o turn inteiro falha com `503`, mesmo que uma chamada anterior tenha sido atendida. Efeitos de ferramenta já executados não são desfeitos por esta feature.
- Retry só no primário. A reserva é uma única tentativa; falhou, acaba a cadeia daquela chamada.
- Erro que a fábrica trata como falha da invocação do modelo (exceção da chamada): entra em retry e, se couber, em fallback. Validação de entrada HTTP (400/422) e conversa inexistente (404) não mudam.
- Resposta `200` sempre inclui `metrics.fallbacks` (inteiro ≥ 0). Respostas de erro (`400`, `404`, `422`, `500`, `503`, `504`) não precisam de métricas nem de trace de fallback.
- Timeout de borda (`504`) permanece distinto de modelo indisponível (`503`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O exemplo de ambiente versionado (`.env.example`) MUST documentar `OPENROUTER_MODEL_FALLBACK` sem valor secreto. O arquivo `.env` real MUST continuar fora do versionamento.
- **FR-002**: `OPENROUTER_MODEL_FALLBACK` MUST ser opcional. Ausente, vazia ou só espaços significa que não há modelo reserva.
- **FR-003**: A fábrica única de modelo em `src/agents/model.ts` (o pedido cita `models.ts`; a fábrica existente é esta) MUST construir o primário com `OPENROUTER_MODEL`, a mesma chave, a mesma base URL e temperatura 0 de hoje, e MUST envolvê-lo com `withRetry` antes de qualquer reserva.
- **FR-004**: O primário MUST ser tentado no máximo 3 vezes por chamada (`withRetry` com o padrão da biblioteca, `stopAfterAttempt` 3). Só depois da terceira falha a reserva pode ser acionada.
- **FR-005**: Quando `OPENROUTER_MODEL_FALLBACK` está definida e não é branco, a fábrica MUST devolver o primário já com retry encadeado em `withFallbacks([reserva])`, em que a reserva usa esse identificador, a mesma chave, a mesma base URL e temperatura 0, sem `withRetry` próprio.
- **FR-006**: Quando não há reserva, a fábrica MUST devolver só o primário com retry e MUST NOT registrar fallback.
- **FR-007**: Toda chamada de modelo de produção que hoje usa a fábrica MUST passar por essa cadeia. Não fica caminho de produção que chame o primário “nu”, sem retry.
- **FR-008**: Toda resposta `200` de `POST /chat` MUST incluir `metrics.fallbacks` (inteiro ≥ 0) igual ao número de chamadas de modelo daquele turn atendidas pela reserva.
- **FR-009**: Para cada chamada atendida pela reserva, o trace do turn `200` MUST incluir um evento `type: "fallback"` com `from` igual ao identificador do primário e `to` igual ao da reserva. A quantidade de eventos `fallback` MUST ser igual a `metrics.fallbacks`.
- **FR-010**: Se o primário esgota as 3 tentativas e a reserva falha ou não existe, `POST /chat` MUST responder `503` com corpo `{ error: { code, message } }`, código de domínio de modelo indisponível (não `INTERNAL_ERROR` / `500`) e mensagem legível sem stack nem payload bruto do provedor.
- **FR-011**: A mesma falha total MUST ser um erro de domínio, traduzido na borda HTTP como `503` e, nas outras bordas, como falha explícita sem resposta de sucesso.
- **FR-012**: Timeout de chat já existente MUST continuar `504`. Configuração ausente de chave ou de modelo primário MUST continuar erro de configuração, não `503`.
- **FR-013**: Testes automatizados MUST cobrir, sem rede: (a) primário recupera na 3ª tentativa, reserva não chamada, `fallbacks` 0; (b) primário esgota e reserva responde, evento `fallback` e `fallbacks` ≥ 1; (c) primário e reserva falham → `503`; (d) reserva ausente e primário esgota → `503` sem segunda chamada.

### Key Entities

- **Modelo primário**: identificador `OPENROUTER_MODEL`. Recebe até 3 tentativas por chamada.
- **Modelo reserva**: identificador opcional `OPENROUTER_MODEL_FALLBACK`. Uma tentativa, só depois do primário esgotar as suas.
- **Evento de fallback**: registro no trace do turn (`type: "fallback"`, `from`, `to`) de que a reserva atendeu uma chamada.
- **Métrica de fallbacks**: contagem, no turn bem-sucedido, de chamadas atendidas pela reserva.
- **Indisponibilidade de modelo**: falha de domínio quando a cadeia inteira da chamada não produz resposta; na borda HTTP vira `503`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turns de teste em que o primário falha duas vezes e responde na terceira, o cliente recebe sucesso e a reserva não é chamada.
- **SC-002**: Em 100% dos turns de teste em que o primário falha três vezes e a reserva responde, o cliente recebe a resposta da reserva.
- **SC-003**: Em 100% dos turns de sucesso em que a reserva atendeu N chamadas, o trace tem N eventos de troca e a métrica de fallbacks é N. Quando N é 0, não há evento de troca.
- **SC-004**: Em 100% dos turns de teste em que primário e reserva falham, o cliente recebe indisponibilidade (`503`), nunca sucesso nem erro interno genérico (`500`).
- **SC-005**: Em 100% dos turns de teste sem reserva configurada, o esgotamento do primário produz a mesma indisponibilidade e nenhuma chamada extra de modelo.
- **SC-006**: A suíte desses cenários conclui sem rede e falha se a reserva for chamada antes das 3 tentativas do primário, ou se a troca não aparecer no trace e na métrica.

## Assumptions

- “fábrica models.ts” refere-se à fábrica já existente `createModel` em `src/agents/model.ts`, não a um arquivo novo.
- `withRetry` sem argumento extra usa o padrão atual da biblioteca: 3 tentativas no total (`stopAfterAttempt` 3). O plano pode fixar esse número de forma explícita para o teste não depender de mudança futura do default.
- A ordem é retry no primário e só então a lista de reservas: `primário.withRetry().withFallbacks([reserva])`. A reserva não é reintentada.
- “Falha” da chamada é exceção lançada pela invocação do modelo. A reserva não é usada para corrigir saída estruturada inválida depois de uma invocação bem-sucedida, salvo se essa validação fizer parte do runnable que lança — o plano confirma o ponto de corte.
- `metrics.fallbacks` é o nome do campo novo. Turnos `200` sempre o trazem, inclusive 0.
- O evento de trace usa `from` e `to` com os identificadores de modelo configurados. Campo `node` segue o padrão opcional dos outros eventos, se a montagem do trace já o preencher.
- Código de domínio sugerido para o `503`: `MODEL_UNAVAILABLE`. Nome final da classe fica no plano, desde que o HTTP não use `500` nem `INTERNAL_ERROR` nesse caso.
- Chave, base URL e temperatura 0 da reserva são os mesmos do primário. Só o identificador de modelo muda.
- Efeitos colaterais de ferramentas anteriores a uma falha total não são revertidos nesta feature.
- Fora de escopo: mais de uma reserva, retry na reserva, circuit breaker, escolha de reserva por tipo de erro, streaming e alteração dos códigos `400`/`404`/`422`/`504`.
