# Feature Specification: Memória semântica por usuário

**Feature Branch**: `008-semantic-memory`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Memória semântica: MemoryStore por userId - rember (dedup -> 0.92), recall top-3 por produto escalar (min 0.3), forget; tabelas memories, embedding all-MiniLM-L6-v2 local em BLOB; /chat ganha userId e injeta o recall no prompt; teste: recall acha fato sem palavra em comum. user: @huggingface/transformers com pooling: mean + normaliza: true e lazy singleton src/memory/embeddings.ts e src/memory-store.ts. As colunas de memories (id, user_id, fact, embedding, created_at)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lembrar e recuperar fatos por significado (Priority: P1)

Um operador (ou o runtime em nome dele) grava fatos associados a um `userId`. Depois, ao consultar com uma pergunta que **não compartilha palavras** com o texto gravado, o sistema devolve os fatos semanticamente mais próximos daquele usuário (até 3, acima do limiar mínimo de relevância).

**Why this priority**: Sem recall semântico confiável e isolado por usuário, não há valor de memória; o teste “sem palavra em comum” é o critério de aceite central do pedido.

**Independent Test**: Com store em `:memory:` (ou fake com embeddings reais locais), `remember` um fato (ex.: “prefiro alertas em português”); `recall` com consulta parafraseada sem tokens em comum (ex.: “qual idioma das notificações?”); confirmar que o fato aparece no top-3 com score ≥ 0,3.

**Acceptance Scenarios**:

1. **Given** um `userId` sem memórias, **When** se chama `remember` com um fato, **Then** o fato fica persistido e vinculado apenas a esse usuário.
2. **Given** um fato gravado para o usuário A, **When** se faz `recall` com consulta semanticamente equivalente mas sem palavras em comum, **Then** o fato de A aparece entre os até 3 resultados com similaridade ≥ 0,3.
3. **Given** fatos do usuário A e do usuário B, **When** se faz `recall` para A, **Then** nenhum fato de B é retornado.

---

### User Story 2 - Evitar duplicatas e esquecer fatos (Priority: P2)

Ao gravar um fato muito parecido com outro já existente do mesmo usuário (similaridade ≥ 0,92), o sistema não cria duplicata. O operador (ou o runtime) pode remover um fato específico via `forget`, após o qual ele deixa de aparecer no `recall`.

**Why this priority**: Dedup e esquecimento protegem a qualidade da memória; dependem do P1 já persistir e recuperar.

**Independent Test**: `remember` o mesmo significado duas vezes (textos distintos com similaridade ≥ 0,92) e verificar uma única memória efetiva; `forget` pelo id e confirmar que `recall` deixa de devolver aquele fato.

**Acceptance Scenarios**:

1. **Given** um fato já memorizado, **When** se tenta `remember` outro texto do mesmo usuário com similaridade ≥ 0,92 ao existente, **Then** não se cria uma segunda linha duplicada (noop ou equivalência documentada).
2. **Given** um fato memorizado com id conhecido, **When** se chama `forget` com esse id (escopo do `userId`), **Then** o fato deixa de existir e não retorna em `recall`.
3. **Given** um id inexistente ou de outro usuário, **When** se chama `forget`, **Then** o resultado é previsível (noop ou erro de domínio) sem afetar memórias de outros usuários.

---

### User Story 3 - Chat usa memória do usuário no prompt (Priority: P3)

O cliente de `POST /chat` informa `userId`. Antes de executar a estratégia, o runtime faz `recall` da mensagem atual e injeta os fatos recuperados no prompt, para a resposta considerar o que já se sabe sobre aquele usuário.

**Why this priority**: Entrega o valor no produto (chat); depende do store P1.

**Independent Test**: Pré-popular memórias via `remember` para um `userId`; chamar `POST /chat` com esse `userId` e mensagem que exige o fato; com estratégia fake, inspecionar que o prompt/composição recebeu os fatos do recall (ou métrica/observabilidade equivalente).

**Acceptance Scenarios**:

1. **Given** um corpo válido com `userId` e memórias relevantes já gravadas, **When** o cliente chama `POST /chat`, **Then** o recall (top-3, min 0,3) é injetado no prompt da composição antes da estratégia.
2. **Given** um corpo válido sem `userId`, **When** o cliente chama `POST /chat`, **Then** o comportamento atual (sem memória semântica) permanece; não há recall.
3. **Given** `userId` presente mas sem memórias acima do limiar, **When** o chat executa, **Then** o prompt segue sem bloco de memória (ou com lista vazia), sem falhar.

---

### Edge Cases

- `remember` com fato vazio ou só espaços: rejeição na fronteira (validação Zod / erro de domínio).
- `userId` vazio ou só espaços: rejeição na fronteira.
- `recall` sem memórias ou todas abaixo de 0,3: lista vazia.
- Empate de scores no top-3: desempate estável e testado (ex.: `created_at` mais recente, depois `id`).
- Embedding ainda não carregado na primeira chamada: lazy load; falha de carga do modelo local vira erro de domínio/borda claro (sem vazar stack de IO).
- Isolamento: `forget` de um usuário não apaga memória de outro mesmo que o texto coincida.
- Reinício do processo com o mesmo `OPSPILOT_DB`: memórias e embeddings BLOB sobrevivem.
- Contratos existentes de `conversationId`, `strategy`, `reflect`, timeout 180s, 400/422/504 permanecem inalterados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar um contrato `MemoryStore` com ao menos `remember`, `recall` e `forget`, sempre escopados por `userId`.
- **FR-002**: `remember(userId, fact)` MUST vetorizar o fato, persistir na tabela `memories` e aplicar deduplicação semântica: se existir memória do mesmo `userId` com similaridade ≥ 0,92, MUST NÃO inserir duplicata.
- **FR-003**: `recall(userId, query)` MUST vetorizar a consulta, ranquear memórias do usuário por produto escalar (vetores normalizados ⇒ similaridade cosseno) e devolver no máximo 3 fatos com score ≥ 0,3, em ordem decrescente de score.
- **FR-004**: `forget(userId, id)` MUST remover a memória indicada se pertencer ao `userId`; caso contrário, comportamento previsível sem efeito colateral em outros usuários.
- **FR-005**: O sistema MUST persistir memórias na tabela `memories` no SQLite embarcado (`OPSPILOT_DB`, padrão `./data/opspilot.db`), com colunas `id`, `user_id`, `fact`, `embedding` (BLOB), `created_at`; DDL idempotente e statements preparados.
- **FR-006**: Embeddings MUST usar o modelo local `all-MiniLM-L6-v2` via `@huggingface/transformers`, com pooling `mean` e `normalize: true`, expostos por um lazy singleton em `src/memory/embeddings.ts`.
- **FR-007**: A implementação SQLite do store MUST viver em `src/memory-store.ts` (ou caminho equivalente alinhado ao plano), injetável na composição; testes MUST poder usar `:memory:` e/ou fake.
- **FR-008**: `POST /chat` MUST aceitar `userId` opcional no corpo (além dos campos já existentes), validado com Zod.
- **FR-009**: Quando `userId` estiver presente, o runtime MUST executar `recall` da mensagem atual e injetar os fatos recuperados no prompt via composição (não pelo cliente).
- **FR-010**: Quando `userId` estiver ausente, o chat MUST manter o comportamento atual sem chamar memória semântica.
- **FR-011**: Testes MUST cobrir, sem rede para o LLM do chat: (a) `recall` encontra fato sem palavra em comum com a query; (b) dedup ≥ 0,92; (c) top-3 e limiar 0,3; (d) isolamento por `userId`; (e) injeção no fluxo `/chat` com estratégia fake. O download/cache do modelo de embedding local na primeira execução de teste é permitido e documentado no plano/quickstart.
- **FR-012**: Entradas inválidas (`userId`/`fact` vazios, tipos errados) MUST ser rejeitadas na fronteira com validação Zod / erro de domínio traduzido na borda.

### Key Entities

- **Memory**: fato textual de um usuário, com vetor de embedding, identificador e instante de criação.
- **UserMemoryScope**: isolamento lógico de memórias por `userId`.
- **RecallResult**: até 3 fatos ranqueados com score de similaridade (≥ 0,3).
- **ChatRequest**: solicitação ao `/chat` com `userId` opcional (além de `message`, `conversationId?`, `strategy?`, `reflect?`).
- **EmbeddingPipeline**: conversão texto → vetor unitário usada por `remember` e `recall`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de teste com fato e consulta semanticamente equivalentes sem tokens em comum, o fato aparece no `recall` (top-3, score ≥ 0,3).
- **SC-002**: Em 100% das tentativas de `remember` com similaridade ≥ 0,92 ao existente do mesmo usuário, nenhuma linha duplicada é criada.
- **SC-003**: `recall` nunca devolve mais de 3 itens nem itens com score < 0,3.
- **SC-004**: 100% dos `recall`/`forget` de um `userId` não expõem nem alteram memórias de outro `userId`.
- **SC-005**: 100% das solicitações `/chat` com `userId` e memórias relevantes injetam esses fatos no prompt da composição.
- **SC-006**: 100% das solicitações `/chat` sem `userId` preservam o contrato atual (sem bloco de memória semântica).
- **SC-007**: Após gravar memórias e reiniciar o processo com o mesmo arquivo de dados, 100% dos fatos permanecem recuperáveis via `recall`.

## Assumptions

- O typo `rember` do pedido significa `remember`; `normaliza: true` significa `normalize: true` na pipeline de embedding.
- Similaridade é o produto escalar de vetores L2-normalizados (equivalente a cosseno); limiares 0,92 (dedup) e 0,3 (recall) são fixos nesta feature.
- `userId` no `/chat` é opcional para não quebrar clientes da spec `007-persistent-conversation`; memória só entra quando informado.
- `remember` / `forget` são operações do `MemoryStore` usadas pelo runtime e pelos testes; endpoint HTTP dedicado ou tool do agente para gravar/esquecer fica fora do escopo desta feature (pode ser feature seguinte).
- A tabela `memories` vive no mesmo banco SQLite do store operacional / conversas (`OPSPILOT_DB`), alinhado à constituição VII.
- O modelo `all-MiniLM-L6-v2` roda localmente (sem OpenRouter para embeddings); lazy singleton evita recarregar o modelo a cada chamada.
- Caminhos `src/memory/embeddings.ts` e `src/memory-store.ts` são invariantes do pedido; detalhe fino de módulos MVC fica para `/speckit-plan`.
- Autenticação/autorização de `userId`, UI de gestão de memórias, expiração TTL e busca híbrida (BM25) ficam fora do escopo.
- Comportamentos de `conversationId`, `historyMessages`, `strategy`, `reflect` e códigos HTTP existentes permanecem válidos.
