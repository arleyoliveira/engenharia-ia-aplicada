# Feature Specification: Medição de contexto do chat

**Feature Branch**: `010-context-usage-metrics`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "instrumente a medição de contexto: src/context/tokens.ts com estimateTokens (chars/4) e o usage real do LangChain; métricas do /chat com promptTokens real e contextBreakdown estimado por fontes; conversa-longa.sh imprime o promptTokens por turno. Com testes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver o tamanho real do prompt em cada resposta (Priority: P1)

O operador (ou um teste automatizado) envia um turn em `POST /chat` e lê, nas métricas da resposta, quantos tokens de prompt o runtime do modelo realmente contabilizou naquele turn. O número vem do usage reportado pelo modelo, não de uma estimativa local.

**Why this priority**: Sem o tamanho real, o plantão não sabe quanto contexto o modelo de fato consumiu. Estimativa e script dependem desse número estar na resposta.

**Independent Test**: Com estratégia fake que reporta usage de entrada conhecido (sem rede), chamar o fluxo de chat e verificar que `metrics.promptTokens` é a soma dos tokens de entrada reportados. Sem usage reportado, o valor é `0`.

**Acceptance Scenarios**:

1. **Given** um turn bem-sucedido em que o runtime do modelo reporta tokens de entrada, **When** o cliente lê a resposta `200`, **Then** `metrics.promptTokens` é um inteiro ≥ 0 igual à soma dos tokens de entrada de todas as chamadas de modelo daquele turn.
2. **Given** um turn bem-sucedido em que nenhuma chamada reporta usage, **When** o cliente lê a resposta `200`, **Then** `metrics.promptTokens` é `0`.
3. **Given** um turn com várias chamadas de modelo (ferramentas ou reflexão), **When** cada chamada reporta seus próprios tokens de entrada, **Then** `promptTokens` soma todas elas e não fica só na primeira chamada.

---

### User Story 2 - Ver de onde veio o contexto montado (Priority: P2)

Além do total real, a resposta mostra uma estimativa do contexto montado pelo OpsPilot, partida por fonte: mensagem atual, histórico injetado e memórias recuperadas. A estimativa usa a regra fixa de um token a cada quatro caracteres, arredondada para baixo.

**Why this priority**: O total real não diz se o crescimento veio do histórico, das memórias ou da mensagem. A partição estimada permite auditar a janela sem depender do provedor fatiar o usage.

**Independent Test**: Com textos conhecidos (mensagem, histórico e fatos), calcular `floor(caracteres/4)` por fonte e comparar com `metrics.contextBreakdown`. Fontes vazias valem `0`. Não é necessário que a soma das fontes iguale `promptTokens`.

**Acceptance Scenarios**:

1. **Given** mensagem, histórico e memórias com textos conhecidos, **When** o turn conclui com sucesso, **Then** `metrics.contextBreakdown` traz `message`, `history` e `memories`, cada um igual à soma das estimativas dos textos daquela fonte.
2. **Given** conversa nova sem histórico e sem memórias, **When** o turn conclui, **Then** `history` e `memories` são `0` e `message` estima só a mensagem atual.
3. **Given** um texto cujo número de caracteres não é múltiplo de 4, **When** se estima essa fonte, **Then** o valor é o quociente inteiro (sobra descartada), nunca o arredondamento para o inteiro mais próximo.

---

### User Story 3 - Plantão longo imprime o tamanho real por turno (Priority: P3)

Quem roda o ensaio de conversa longa vê, em cada turno, o `promptTokens` real devolvido na métrica daquele `POST /chat`, para acompanhar o crescimento do contexto ao longo dos 30 turnos.

**Why this priority**: É a leitura operacional da métrica P1. Depende do campo já estar na resposta.

**Independent Test**: Contra um servidor que devolve `metrics.promptTokens` (pode ser fake), executar o script de conversa longa e confirmar que cada linha de turno imprime esse valor. Se o campo vier ausente, a linha mostra o fallback já previsto (`n/a`) em vez de falhar o turno.

**Acceptance Scenarios**:

1. **Given** respostas `200` com `metrics.promptTokens` numérico, **When** o script de conversa longa completa um turno, **Then** a linha daquele turno contém `promptTokens=` seguido do inteiro da resposta.
2. **Given** uma resposta `200` sem o campo, **When** o script imprime o turno, **Then** mostra `promptTokens=n/a` e segue se o restante da resposta for válido.
3. **Given** os 30 turnos do ensaio no mesmo `conversationId`, **When** o script termina com sucesso, **Then** há uma linha de medição por turno, cada uma com o `promptTokens` da resposta correspondente.

---

### Edge Cases

- Texto vazio ou só espaços na estimativa: `0` tokens (comprimento 0 após a regra de caracteres; a validação de `message` vazia no `/chat` permanece a da fronteira atual e não muda).
- Caracteres fora de ASCII: a contagem usa o comprimento da string (unidades de código), não bytes UTF-8. A estimativa local do script com `wc -c` pode divergir e não é a fonte da verdade.
- Histórico acima da janela: só as mensagens efetivamente injetadas entram em `contextBreakdown.history`.
- `userId` ausente ou recall vazio: `contextBreakdown.memories` é `0`.
- Usage parcial (algumas chamadas com usage, outras sem): somam-se apenas as chamadas que reportam tokens de entrada; as demais contribuem `0`.
- Soma das fontes estimadas diferente de `promptTokens`: esperado. O real inclui system prompt, ferramentas, observações intermediárias e a não-linearidade do piso; a partição cobre só mensagem, histórico e memórias.
- Falha do turn (400, 404, 422, 504): não há métricas de contexto; o corpo de erro permanece o atual.
- Estratégia fake de teste sem usage: `promptTokens` é `0` e `contextBreakdown` ainda é calculado a partir da mensagem, do histórico e das memórias daquele turn.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST expor `estimateTokens` em `src/context/tokens.ts`. Para qualquer string, o resultado MUST ser `floor(comprimento / 4)`, com comprimento igual ao da string e piso para baixo.
- **FR-002**: `estimateTokens` MUST ser uma função pura: sem IO, sem chamada de modelo, mesmo resultado para o mesmo texto.
- **FR-003**: O runtime MUST ler o usage real reportado pelo LangChain em cada chamada de modelo do turn (tokens de entrada / prompt) e agregá-lo.
- **FR-004**: Toda resposta `200` de `POST /chat` MUST incluir `metrics.promptTokens` (inteiro ≥ 0) igual à soma dos tokens de entrada reportados em todas as chamadas de modelo daquele turn, inclusive ferramentas e reflexão quando houver. Chamada sem usage contribui `0`.
- **FR-005**: Toda resposta `200` de `POST /chat` MUST incluir `metrics.contextBreakdown` com as fontes `message`, `history` e `memories`, cada uma inteiro ≥ 0.
- **FR-006**: `contextBreakdown.message` MUST ser `estimateTokens` da mensagem atual do turn.
- **FR-007**: `contextBreakdown.history` MUST ser a soma de `estimateTokens` do conteúdo de cada mensagem de histórico injetada naquele turn (janela já aplicada). Rótulos de papel não entram na conta.
- **FR-008**: `contextBreakdown.memories` MUST ser a soma de `estimateTokens` de cada fato de memória injetado naquele turn. Cabeçalhos de formatação não entram na conta.
- **FR-009**: O sistema MUST NOT exigir que `message + history + memories` seja igual a `promptTokens`.
- **FR-010**: `metrics.llmCalls`, `metrics.latencyMs`, `metrics.historyMessages` e `metrics.recalledMemories` MUST permanecer com o significado atual.
- **FR-011**: `scripts/conversa-longa.sh` MUST imprimir, em cada turno, o `promptTokens` lido de `.metrics.promptTokens` da resposta daquele turno (fallback `n/a` se o campo estiver ausente).
- **FR-012**: Testes automatizados MUST cobrir, sem rede para o modelo: (a) `estimateTokens` em string vazia, comprimento menor que 4 e resto não nulo; (b) `contextBreakdown` por fonte, inclusive fontes vazias; (c) `promptTokens` somado a partir de usage reportado e `0` quando não houver usage; (d) presença dos dois campos no `200` do `/chat`. O ensaio ao vivo dos 30 turnos não é obrigatório na suíte.

### Key Entities

- **TokenEstimate**: inteiro ≥ 0 obtido por `floor(caracteres / 4)` sobre um texto.
- **ContextBreakdown**: partição estimada do contexto montado, com `message`, `history` e `memories`.
- **TurnPromptUsage**: soma real dos tokens de entrada reportados pelo runtime do modelo nas chamadas daquele turn (`promptTokens`).
- **ChatMetrics**: métricas já existentes do turn, acrescidas de `promptTokens` e `contextBreakdown`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de teste de estimativa (vazio, comprimento &lt; 4 e resto não nulo), o valor é o quociente inteiro do número de caracteres por 4.
- **SC-002**: Em 100% das respostas de chat bem-sucedidas, o tamanho real do prompt aparece como inteiro ≥ 0.
- **SC-003**: Em 100% das respostas de chat bem-sucedidas, a partição estimada traz as três fontes (mensagem atual, histórico injetado, memórias recuperadas), cada uma inteiro ≥ 0 e coerente com a regra de quatro caracteres.
- **SC-004**: Quando o runtime não reporta usage, 100% desses turns ainda devolvem tamanho real `0` e a partição estimada preenchida.
- **SC-005**: No ensaio de conversa longa concluído com sucesso, 100% dos turnos impressos mostram o tamanho real lido da resposta daquele turno.
- **SC-006**: Em 100% dos testes de regressão do chat, contagem de histórico, memórias recuperadas, identificador de conversa e códigos de erro existentes permanecem iguais aos de hoje.

## Assumptions

- “chars/4” significa `floor(comprimento da string / 4)`. Não é arredondamento comercial nem contagem de bytes.
- `promptTokens` é o usage real de entrada agregado no turn. `contextBreakdown` é só estimativa das três fontes compostas pelo chat (mensagem, histórico, memórias). System prompt, definições de ferramentas e observações intermediárias ficam de fora da partição e explicam a diferença para o total real.
- Várias chamadas no mesmo turn (ReAct, reflexão) somam tokens de entrada. Não se reporta apenas a primeira chamada.
- Campo de usage ausente ou ilegível conta como `0` naquela chamada; o turn não falha por falta de usage.
- Os nomes `promptTokens`, `contextBreakdown`, `message`, `history` e `memories` são o contrato da resposta e do script. O caminho `src/context/tokens.ts` e a leitura do usage do LangChain são invariantes do pedido; o ponto exato de coleta (callback ou metadados da mensagem) fica para `/speckit-plan`.
- `conversa-longa.sh` já imprime `promptTokens` com fallback `n/a`; esta feature torna o valor real disponível na resposta e mantém esse formato de linha. Estimativa local `req≈` / `res≈` do script permanece auxiliar e fora do contrato de `promptTokens`.
- Custos, tokens de saída, limite de janela e truncamento automático de contexto ficam fora do escopo.
- Contratos de `conversationId`, `userId`, `strategy`, `reflect`, janela de histórico e códigos HTTP existentes permanecem válidos.
