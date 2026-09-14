# Feature Specification: Endpoint de Chat Operacional

**Feature Branch**: `003-chat-endpoint`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "POST /chat em src/http/servers.ts (ou padrão do express): body { message, strategy?, reflect?} validado com zod, default react. 200 { answer, trace, metrics}; 400 body inválido (issues do zod); 422 estratégia desconhecida; timeout 180s -> 504. Registry em src/agents/index.ts (nome -> estratégia; reflect aplica withReflection). Teste de integração com estratégia fake determinística, sem rede."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enviar uma solicitação operacional ao OpsPilot (Priority: P1)

Um operador de plantão envia uma mensagem de incidente ao serviço de chat e recebe a resposta produzida pela estratégia padrão do OpsPilot, incluindo o histórico de raciocínio observável e as métricas de execução. O operador não precisa conhecer ou informar a estratégia para obter uma resposta.

**Why this priority**: Esta é a capacidade essencial do endpoint: tornar o raciocínio operacional disponível a consumidores HTTP com um contrato estável.

**Independent Test**: Enviar uma requisição válida contendo apenas `message` para `POST /chat` usando uma estratégia fake determinística e confirmar resposta HTTP 200 contendo `answer`, `trace` e `metrics`, sem acesso de rede.

**Acceptance Scenarios**:

1. **Given** um corpo válido com apenas `message`, **When** o cliente chama `POST /chat`, **Then** a estratégia padrão `react` é executada e a resposta é `200` contendo `answer`, `trace` e `metrics`.
2. **Given** um corpo válido com `message` e uma estratégia registrada, **When** o cliente chama `POST /chat`, **Then** a estratégia indicada é executada e a resposta mantém o mesmo formato de sucesso.

---

### User Story 2 - Solicitar uma resposta revisada por reflexão (Priority: P2)

Um operador que precisa de maior confiabilidade para uma ação operacional solicita explicitamente revisão reflexiva. O serviço resolve a estratégia indicada, aplica a camada de reflexão e devolve o resultado final junto aos eventos de crítica no histórico de raciocínio.

**Why this priority**: A reflexão amplia a segurança da resposta, mas depende do fluxo básico de chat já estar disponível.

**Independent Test**: Enviar uma requisição válida contendo `message`, `strategy: "react"` e `reflect: true` com registry fake e confirmar que o registry recebe a opção de reflexão e o resultado devolvido inclui o trace produzido pela estratégia resolvida.

**Acceptance Scenarios**:

1. **Given** uma estratégia base registrada e `reflect: true`, **When** o cliente chama `POST /chat`, **Then** o serviço executa a versão com reflexão dessa estratégia e devolve a resposta e o trace dela.
2. **Given** `reflect` omitido ou igual a `false`, **When** o cliente chama `POST /chat`, **Then** o serviço executa a estratégia base, sem adicionar reflexão.

---

### User Story 3 - Receber erros HTTP acionáveis (Priority: P3)

Um consumidor de API recebe respostas previsíveis quando envia um corpo inválido, pede uma estratégia inexistente ou quando a estratégia excede o tempo máximo. As respostas permitem ao consumidor corrigir a solicitação ou decidir se deve tentar novamente.

**Why this priority**: Contratos de falha claros evitam que integrações automáticas confundam erros de validação, seleção e indisponibilidade temporária.

**Independent Test**: Exercitar o endpoint com corpo inválido, estratégia ausente do registry e uma estratégia fake que não conclui antes do tempo configurado; verificar respectivamente 400 com `issues` do Zod, 422 e 504.

**Acceptance Scenarios**:

1. **Given** um corpo sem `message`, uma mensagem vazia ou campos de tipos inválidos, **When** o cliente chama `POST /chat`, **Then** recebe `400` e uma lista de `issues` de validação.
2. **Given** uma estratégia que não existe no registry, **When** o cliente chama `POST /chat`, **Then** recebe `422` com mensagem que identifica a estratégia desconhecida.
3. **Given** uma estratégia que ultrapassa o limite de 180 segundos, **When** o cliente chama `POST /chat`, **Then** recebe `504` sem aguardar indefinidamente.

---

### Edge Cases

- Corpo JSON malformado ou ausente deve produzir `400` com detalhe suficiente para corrigir a requisição e sem expor erro interno.
- A propriedade `reflect` aceita somente valores booleanos; valores como `"true"`, `1` ou objetos são inválidos.
- A propriedade `strategy`, quando informada, deve ser texto não vazio após remoção de espaços; caso contrário, é erro de validação `400`.
- O encerramento por timeout não deve transformar uma resposta que concluiu antes de 180 segundos em erro.
- Falhas inesperadas da estratégia devem permanecer erros de domínio já traduzíveis na borda, sem expor segredos ou detalhes do provedor.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor uma rota HTTP `POST /chat` para receber solicitações de raciocínio operacional.
- **FR-002**: O corpo da requisição MUST aceitar `message` (texto obrigatório não vazio), `strategy` (texto opcional) e `reflect` (booleano opcional), com `strategy` assumindo `react` e `reflect` assumindo `false` quando omitidos.
- **FR-003**: Toda entrada do corpo MUST ser validada com Zod antes de ser encaminhada ao registry ou a qualquer estratégia.
- **FR-004**: Para uma solicitação válida, a rota MUST responder `200` com o objeto `{ answer, trace, metrics }` retornado pela estratégia selecionada.
- **FR-005**: Para um corpo ausente, JSON malformado ou dados incompatíveis com o schema, a rota MUST responder `400` contendo as `issues` de validação do Zod.
- **FR-006**: Para um nome de estratégia que o registry não reconhece, a rota MUST responder `422` e informar qual nome não foi encontrado.
- **FR-007**: A rota MUST encerrar uma execução que não conclua em até 180 segundos e responder `504`.
- **FR-008**: O sistema MUST disponibilizar um registry central em `src/agents/index.ts` que resolva nomes de estratégia para instâncias de `ReasoningStrategy`.
- **FR-009**: Quando `reflect` for `true`, o registry MUST aplicar `withReflection` à estratégia resolvida antes da execução; quando `false`, MUST retornar a estratégia base.
- **FR-010**: O servidor HTTP e o registry MUST aceitar injeção de dependências para permitir testes de integração determinísticos sem rede ou credenciais de modelo.

### Key Entities

- **ChatRequest**: Solicitação recebida pelo endpoint, com mensagem operacional obrigatória, estratégia opcional e flag opcional de reflexão.
- **ChatResponse**: Resultado de uma estratégia, composto por resposta textual, trace de eventos ordenados e métricas de chamadas/latência.
- **StrategyRegistry**: Catálogo que mapeia nomes públicos de estratégias para suas implementações e pode decorá-las com reflexão.
- **ValidationIssue**: Item de erro de validação devolvido ao consumidor quando o corpo não atende ao contrato.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das solicitações válidas executadas contra uma estratégia registrada recebem resposta `200` com `answer`, `trace` e `metrics`.
- **SC-002**: 100% dos corpos inválidos exercitados na suíte de integração recebem `400` com ao menos uma issue de validação.
- **SC-003**: 100% das solicitações para estratégias ausentes do registry recebem `422`, sem iniciar execução de estratégia.
- **SC-004**: 100% das execuções que excedem 180 segundos recebem `504`, enquanto execuções concluídas dentro desse intervalo mantêm resposta `200`.
- **SC-005**: A suíte de integração do endpoint executa sem rede e sem credenciais externas.

## Assumptions

- O servidor escutará em porta configurável pelo ambiente na inicialização; definir um valor padrão é responsabilidade da implementação, não altera o contrato `POST /chat`.
- O timeout de 180 segundos vale por requisição inteira, incluindo estratégia base, reflexão e quaisquer chamadas internas.
- O formato de `trace` e `metrics` já estabelecido pelo núcleo de raciocínio é o contrato de resposta utilizado pelo endpoint.
- A versão inicial não inclui autenticação, persistência de conversas, streaming, cancelamento pelo cliente ou endpoints adicionais.
