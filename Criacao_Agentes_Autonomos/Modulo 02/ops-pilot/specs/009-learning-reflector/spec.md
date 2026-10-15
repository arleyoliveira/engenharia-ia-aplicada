# Feature Specification: Refletor de aprendizado

**Feature Branch**: `009-learning-reflector`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Refletor de aprendizado: após cada resposta, um withStructuredOutput({ hasLearing, fact }) lê a última message do usuário e destila fatos duráveis (nunca pedido pontual, nunca segredo) -> memories.remeber assíncrono; tool forget_preference"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Destilar preferências duráveis após o turn (Priority: P1)

Após o OpsPilot responder a um turn de chat com `userId`, um refletor de aprendizado analisa a **última mensagem do usuário**, decide se há um fato durável a guardar e, se sim, persiste esse fato na memória semântica daquele usuário **sem atrasar a resposta HTTP** (gravação assíncrona).

**Why this priority**: Fecha o ciclo da memória semântica (008): o sistema passa a *aprender* sozinho a partir do diálogo, em vez de depender só de `remember` manual/testes.

**Independent Test**: Com modelo/estratégia fake que devolve structured output controlado, executar um turn com mensagem do tipo preferência (“prefiro alertas em português”) e `userId`; após a resposta `200`, verificar que `MemoryStore.remember` foi chamado com um fato durável; para mensagem pontual (“liste alertas firing agora”), verificar que **não** chama `remember`.

**Acceptance Scenarios**:

1. **Given** um turn com `userId` e mensagem que expressa preferência durável, **When** a estratégia conclui com sucesso, **Then** a resposta HTTP é devolvida normalmente e, em background, `remember(userId, fact)` é invocado com um fato destilado (não a mensagem crua, se a destilação produzir formulação própria).
2. **Given** um turn com `userId` e pedido pontual (ex.: “liste os alertas firing”), **When** o refletor classifica `hasLearning = false`, **Then** `remember` **não** é chamado.
3. **Given** um turn **sem** `userId`, **When** a resposta é gerada, **Then** o refletor de aprendizado **não** executa (sem memória para escopar).

---

### User Story 2 - Recusar segredos e pedidos pontuais (Priority: P2)

O refletor nunca persiste segredos (tokens, senhas, chaves, credenciais) nem pedidos pontuais/efêmeros. A decisão vem de saída estruturada `{ hasLearning, fact }` validada na fronteira; se `hasLearning` for falso ou `fact` inválido/vazio, nada é gravado.

**Why this priority**: Segurança e qualidade da memória; depende do gancho P1 existir.

**Independent Test**: Com structured output fake: (a) mensagem com “API key = sk-…” → `hasLearning=false` ou fato rejeitado, sem `remember`; (b) preferência legítima → `hasLearning=true` + fact não vazio → `remember` uma vez.

**Acceptance Scenarios**:

1. **Given** conteúdo que contém segredo óbvio, **When** o refletor avalia a mensagem, **Then** não há persistência via `remember`.
2. **Given** saída estruturada com `hasLearning=true` e `fact` vazio/só espaços, **When** o pós-processamento valida, **Then** `remember` não é chamado.
3. **Given** falha do modelo estruturado ou parse inválido, **When** o turn já respondeu ao cliente, **Then** a falha do refletor é engolida/logada sem alterar o `200` já enviado (aprendizado best-effort).

---

### User Story 3 - Tool `forget_preference` (Priority: P3)

O agente expõe a tool `forget_preference` para o usuário pedir o esquecimento de uma preferência memorizada. A tool remove a memória correspondente no escopo do `userId` do turn (via `MemoryStore`), alinhada ao `forget` da spec 008.

**Why this priority**: Complemento de privacidade/controle; depende do store 008 e do escopo por `userId`.

**Independent Test**: Com `MemoryStore` fake/populado e tool registrada, invocar `forget_preference` com descrição da preferência (ou id, conforme contrato do plano); confirmar remoção e que recall subsequente não devolve o fato.

**Acceptance Scenarios**:

1. **Given** um fato memorizado para o `userId` do turn, **When** o agente chama `forget_preference` com referência suficiente a essa preferência, **Then** a memória deixa de existir para aquele usuário.
2. **Given** preferência inexistente, **When** a tool é chamada, **Then** o resultado é previsível (noop / mensagem clara), sem afetar outros usuários.
3. **Given** turn sem `userId` / sem MemoryStore, **When** a tool é invocada, **Then** falha de domínio clara (não tenta apagar memória global).

---

### Edge Cases

- Resposta da estratégia falha (4xx/5xx): refletor **não** roda (só após sucesso do turn).
- `remember` assíncrono rejeita (IO/embedding): não propaga para o cliente; erro observável em log/métrica opcional.
- Dedup ≥ 0,92 da 008 continua valendo: fato quase-duplicado → `remember` retorna `null` sem linha extra.
- Mensagem do usuário muito longa: refletor ainda vê a mensagem completa do turn (não o histórico inteiro), salvo limite documentado no plano.
- Concorrência: vários turns do mesmo `userId` podem disparar vários `remember` em paralelo; store já isola por usuário.
- Contratos 007/008 (`conversationId`, recall no prompt, códigos HTTP) permanecem válidos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Após cada resposta **bem-sucedida** de `POST /chat` com `userId` presente, o sistema MUST executar um refletor de aprendizado que lê a **última mensagem do usuário** daquele turn.
- **FR-002**: O refletor MUST obter saída estruturada com ao menos `hasLearning: boolean` e `fact: string` (typo do pedido `hasLearing` normalizado para `hasLearning`), via padrão `withStructuredOutput` já usado no projeto (Zod na fronteira).
- **FR-003**: Se `hasLearning === true` e `fact` não vazio após trim, o sistema MUST chamar `MemoryStore.remember(userId, fact)` de forma **assíncrona** (fire-and-forget após enviar a resposta, ou equivalente que não bloqueie o caminho crítico do `200`).
- **FR-004**: O refletor MUST destilar apenas fatos **duráveis** (preferências, restrições estáveis, contexto operacional reutilizável). MUST NÃO persistir pedidos pontuais/efêmeros nem segredos (credenciais, tokens, senhas, chaves de API).
- **FR-005**: Sem `userId`, o refletor MUST ser omitido.
- **FR-006**: Falhas do refletor ou do `remember` assíncrono MUST NÃO alterar o status/corpo de sucesso já determinado do chat.
- **FR-007**: O sistema MUST registrar a tool de agente `forget_preference`, que remove preferência memorizada no escopo do `userId` corrente via `MemoryStore` (`forget` / busca+forget conforme plano).
- **FR-008**: Testes MUST cobrir, com fakes (sem rede LLM quando possível): (a) preferência → `remember` chamado; (b) pedido pontual → sem `remember`; (c) segredo → sem `remember`; (d) tool `forget_preference` remove memória; (e) resposta HTTP não espera o `remember` assíncrono (assert de não-bloqueio ou ordem).

### Key Entities

- **LearningReflection**: resultado estruturado `{ hasLearning, fact }` da destilação pós-turn.
- **DurableFact**: texto persistível que representa preferência/restrição estável (não pontual, não secreto).
- **ForgetPreferenceTool**: ferramenta do agente para apagar preferência no `MemoryStore` do `userId`.
- **ChatTurn** (existente): mensagem do usuário + resposta; gancho pós-sucesso para o refletor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos turns de teste com preferência durável + `userId`, `remember` é invocado ≥ 1 vez com fato não vazio.
- **SC-002**: Em 100% dos turns de teste com pedido pontual ou segredo, `remember` **não** é invocado.
- **SC-003**: Em 100% dos turns sem `userId`, o refletor não executa.
- **SC-004**: A latência do caminho de sucesso do `/chat` nos testes de não-bloqueio **não** inclui a conclusão do `remember` assíncrono (resposta disponível antes do settle do remember, ou assert equivalente).
- **SC-005**: 100% das invocações de teste de `forget_preference` sobre fato existente removem a memória do `userId` alvo sem afetar outros usuários.
- **SC-006**: Falha forçada do refletor em teste mantém o `200` do chat inalterado.

## Assumptions

- Typos do pedido: `hasLearing` → `hasLearning`; `remeber` → `remember`.
- Depende da feature `008-semantic-memory` (`MemoryStore`, `userId` no `/chat`, dedup/recall).
- “Após cada resposta” = após sucesso da estratégia no turn de chat (não após erros 4xx/5xx).
- O refletor analisa só a mensagem do usuário daquele turn (não o histórico completo), salvo o plano expandir com contexto mínimo.
- `withStructuredOutput` segue o padrão LangChain já usado em reflection/plan-and-execute; schema Zod `{ hasLearning, fact }`.
- Gravação assíncrona: o cliente recebe `200` sem aguardar embedding/`remember`; testes usam fake sync observável + assert de scheduling, ou Promise controlada.
- `forget_preference`: argumentos exatos (texto da preferência vs id) ficam para `/speckit-plan`; comportamento = remover no escopo do `userId` do turn/runtime da tool.
- Autenticação forte de `userId`, UI de revisão de memórias e refletor em CLI/arena fora do escopo.
- Prompt do refletor instruirá explicitamente: nunca gravar segredos; nunca gravar pedidos pontuais.
