# Feature Specification: Status de provedores externos

**Feature Branch**: `005-provider-status`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Tool de status de provedores externos — Tool check_provider_status em src/agent/tools.ts: consulta a status page pública do provedor via API statuspage.io (sem chave): github -> https://www.githubstatus.com/api/v2/status.json; cloudflare -> https://www.cloudflarestatus.com/api/v2/status.json. Parâmetro provider (enum: github | cloudflare, default \"github\", .describe explicando). Descrição orientada a quando usar: suspeita de problema externo, \"é o nosso ou do provedor?\", dependência fora do ar. Resiliência: timeout de 5s via AbortSignal.timeout; falha de rede ou 5xx, UMA nova tentativa; resposta validada com zod ({ status: { indicator, description } }); qualquer falha final retorna string de erro legível como resultado da tool (erro é observação - nunca lançar exceção para fora da tool). Retorno compacto (indicador + descrição, uma linha), para não inflar o contexto. Teste: a função de fetch é injetável; testes cobrem sucesso, timeout e resposta inválida sem uso de rede (fake fetch)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Distinguir falha interna de provedor externo (Priority: P1)

Um plantonista (via agente) suspeita que a degradação observada não é do mercadinho, e sim de um provedor externo (GitHub ou Cloudflare). Ele pede para checar o status do provedor. O agente consulta a página pública de status e devolve um resumo curto (indicador + descrição), suficiente para decidir se o incidente é “nosso” ou “do provedor”.

**Why this priority**: É o valor central da feature — reduzir falso positivo de incidente interno quando a dependência externa está degradada.

**Independent Test**: Com um fetch fake que devolve status operacional do GitHub, invocar a ferramenta com `provider` omitido (default) e confirmar uma linha compacta com indicador e descrição; repetir com `cloudflare`.

**Acceptance Scenarios**:

1. **Given** o provedor GitHub reportando operação normal, **When** o agente chama a ferramenta sem informar `provider`, **Then** o resultado é uma linha compacta contendo o indicador e a descrição oficiais do status.
2. **Given** o provedor Cloudflare reportando incidente, **When** o agente chama a ferramenta com `provider: "cloudflare"`, **Then** o resultado reflete o indicador e a descrição desse provedor em uma única linha.
3. **Given** a descrição da ferramenta, **When** o modelo decide se deve usá-la, **Then** fica claro que o uso é para suspeita de problema externo / “é nosso ou do provedor?” / dependência fora do ar — e não para listar alertas internos.

---

### User Story 2 - Falha de consulta não quebra o raciocínio (Priority: P2)

Quando a página de status está lenta, fora do ar ou devolve payload inválido, a ferramenta não derruba a execução do agente. Após esgotar a política de resiliência, ela devolve uma mensagem de erro legível como observação, para o agente continuar o plantão sem stack trace nem exceção não tratada.

**Why this priority**: Ferramenta de diagnóstico que falha de forma ruidosa piora o plantão; a resiliência é pré-requisito operacional da US1.

**Independent Test**: Com fetch fake que simula timeout, 5xx (com uma retentativa) e JSON inválido, confirmar que a ferramenta sempre retorna string legível e nunca propaga exceção para fora.

**Acceptance Scenarios**:

1. **Given** a consulta excede o limite de tempo, **When** a ferramenta é chamada, **Then** após a política de resiliência o resultado é uma string de erro legível (ex.: timeout), sem exceção escapando da tool.
2. **Given** a primeira resposta é erro de servidor (5xx) ou falha de rede, **When** a ferramenta é chamada, **Then** ocorre exatamente uma nova tentativa; se a segunda também falhar, o resultado é erro legível.
3. **Given** a resposta HTTP é 200 mas o corpo não bate no contrato esperado, **When** a ferramenta é chamada, **Then** o resultado é erro legível de validação, sem inflar o contexto com o payload bruto.

---

### User Story 3 - Testes determinísticos sem rede (Priority: P3)

Quem mantém o OpsPilot valida o comportamento da ferramenta com testes isolados: a função de fetch é injetável e os cenários de sucesso, timeout e resposta inválida rodam com fake fetch, sem acesso à internet.

**Why this priority**: Garante regressão segura da US1/US2 sem depender de status pages reais.

**Independent Test**: Executar a suíte de testes da ferramenta com fake fetch; confirmar cobertura de sucesso, timeout e payload inválido, e ausência de chamadas de rede reais.

**Acceptance Scenarios**:

1. **Given** um fake fetch que devolve payload válido, **When** o teste roda, **Then** o resultado compacto de sucesso é assertado sem rede.
2. **Given** um fake fetch que simula timeout, **When** o teste roda, **Then** o resultado de erro legível é assertado.
3. **Given** um fake fetch que devolve corpo inválido, **When** o teste roda, **Then** o resultado de erro de validação é assertado.

---

### Edge Cases

- `provider` fora do conjunto `github` | `cloudflare`: rejeição na fronteira (validação de argumentos) com erro compreensível, sem chamar a rede.
- Resposta 4xx da status page: tratada como falha da consulta (não retentar indefinidamente); após a política definida, erro legível.
- Corpo vazio, JSON malformado ou campos `status.indicator` / `status.description` ausentes: falha de validação → erro legível.
- Segunda tentativa bem-sucedida após 5xx/rede na primeira: devolve o status compacto normal (sucesso).
- Provedores adicionais (AWS, etc.) estão fora de escopo nesta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar a ferramenta operacional `check_provider_status` no mesmo conjunto de ferramentas do agente.
- **FR-002**: A ferramenta MUST aceitar o parâmetro `provider` com valores fechados `github` e `cloudflare`, default `github`, e descrição do parâmetro explicando o significado.
- **FR-003**: A ferramenta MUST consultar apenas as páginas públicas de status dos provedores suportados, sem exigir chave de API ou segredo.
- **FR-004**: A descrição da ferramenta MUST orientar o uso para suspeita de problema externo, distinção “é o nosso ou do provedor?” e dependência fora do ar.
- **FR-005**: Em caso de sucesso, a ferramenta MUST retornar um resumo compacto em uma linha contendo o indicador e a descrição do status, para não inflar o contexto do agente.
- **FR-006**: Cada consulta MUST respeitar um limite de tempo de 5 segundos.
- **FR-007**: Em falha de rede ou resposta de servidor (5xx), a ferramenta MUST realizar exatamente uma nova tentativa antes de concluir em erro.
- **FR-008**: A resposta bem-sucedida MUST ser validada contra o contrato mínimo `{ status: { indicator, description } }` antes de ser resumida.
- **FR-009**: Qualquer falha final (timeout, rede, 5xx após retry, payload inválido) MUST ser devolvida como string de erro legível no resultado da ferramenta; a ferramenta MUST NÃO lançar exceção para fora (o erro é observação do agente).
- **FR-010**: A função de fetch usada pela ferramenta MUST ser injetável para permitir testes sem rede.
- **FR-011**: Testes determinísticos MUST cobrir pelo menos: sucesso, timeout e resposta inválida, usando fake fetch e sem acesso à rede.

### Key Entities

- **Provedor externo**: dependência pública suportada (`github` ou `cloudflare`) com URL de status page conhecida.
- **Status do provedor**: indicador oficial e descrição textual publicados pela status page.
- **Resultado da ferramenta**: ou o resumo compacto de sucesso (uma linha), ou a mensagem de erro legível usada como observação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de sucesso nos testes, o resultado cabe em uma linha e inclui indicador e descrição.
- **SC-002**: Em 100% dos casos de falha final (timeout, rede/5xx após retry, payload inválido), a ferramenta devolve string legível e nenhuma exceção escapa da tool.
- **SC-003**: Após uma falha 5xx/rede na primeira chamada, a ferramenta tenta de novo exatamente uma vez em 100% dos cenários cobertos.
- **SC-004**: A suíte de testes da ferramenta conclui sem nenhuma chamada de rede real.
- **SC-005**: Um mantenedor identifica quando usar (e quando não usar) `check_provider_status` só pela descrição da ferramenta, sem ler o código.

## Assumptions

- O caminho canônico no repositório é `src/agents/tools.ts` (o pedido escreveu `src/agent/tools.ts`; o projeto já usa o plural `agents`).
- As URLs públicas Statuspage.io são: GitHub `https://www.githubstatus.com/api/v2/status.json` e Cloudflare `https://www.cloudflarestatus.com/api/v2/status.json`.
- O contrato Zod mínimo espelha o JSON Statuspage v2: `status.indicator` e `status.description` (strings).
- Timeout de 5s via `AbortSignal.timeout`; retry único apenas para falha de rede ou HTTP 5xx (não para 4xx nem para payload inválido após 200).
- A ferramenta entra no array retornado por `createOpsTools` / `createDefaultOpsTools`, junto às tools operacionais existentes.
- Não há autenticação, cache persistente nem dashboard HTTP novo nesta feature; apenas a tool e seus testes.
- Outros provedores e histórico de incidentes da status page estão fora de escopo.
