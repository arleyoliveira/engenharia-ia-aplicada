# Research: Memória semântica por usuário

**Date**: 2026-09-18 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição VII e o padrão atual de `SqliteOpsStore` + `runChat` / `composeChatPrompt`.

## R1. Biblioteca e modelo de embedding

- **Decision**: Dependência `@huggingface/transformers`. Modelo local `Xenova/all-MiniLM-L6-v2` (port do `sentence-transformers/all-MiniLM-L6-v2`). Pipeline `feature-extraction` com `{ pooling: "mean", normalize: true }`. Lazy singleton em `src/memory/embeddings.ts` (`getEmbedder()` / `embed(text)`).
- **Rationale**: Pedido explícito; Transformers.js roda em Node 22 sem Python; `normalize: true` torna o produto escalar equivalente ao cosseno.
- **Alternatives considered**: (a) OpenRouter embeddings — viola “local” e acopla rede; (b) `sentence-transformers` Python — fora da stack Node; (c) carregar modelo a cada chamada — custo proibitivo.

## R2. Serialização BLOB

- **Decision**: Persistir `Float32Array` como `Buffer` little-endian (`Buffer.from(vector.buffer, byteOffset, byteLength)`). Dimensão esperada 384 (MiniLM-L6). Na leitura, reconstruir `new Float32Array(buffer.buffer, …)` com cópia alinhada se necessário.
- **Rationale**: Simples, portável no SQLite `BLOB`, sem extensão vetorial.
- **Alternatives considered**: (a) JSON de floats — maior e mais lento; (b) sqlite-vss — complexidade e binário nativo fora do escopo do curso.

## R3. Ranking e limiares

- **Decision**: Em `recall` / dedup de `remember`, carregar memórias do `userId` e ranquear em JS por produto escalar. Constantes exportadas: `DEDUP_THRESHOLD = 0.92`, `RECALL_MIN_SCORE = 0.3`, `RECALL_TOP_K = 3`. Empate: `created_at` DESC, depois `id` DESC.
- **Rationale**: Spec fixa limiares; volume por usuário é pequeno (plantão); desempate estável e testável.
- **Alternatives considered**: ANN / Faiss — overkill; threshold configurável via env — fora do pedido.

## R4. Contrato `MemoryStore`

- **Decision**:
  - `remember(userId, fact): Promise<string | null>` — retorna `id` se inseriu; `null` se deduplicado (≥ 0,92).
  - `recall(userId, query): Promise<RecallHit[]>` — `{ id, fact, score }[]`, length ≤ 3, score ≥ 0,3, ordem desc.
  - `forget(userId, id): Promise<boolean>` — `true` se removeu linha do próprio usuário; `false` se id inexistente ou de outro usuário (noop seguro).
  - `userId` / `fact` vazios (após trim) → `InvalidStateError` (ou equivalente de domínio já usado no projeto).
- **Rationale**: Async por causa do embed; retorno de `remember`/`forget` torna asserts de dedup/noop explícitos.
- **Alternatives considered**: (a) `forget` lançar `NotFoundError` — mais barulho para o runtime; (b) sync API — incompatível com pipeline HF.

## R5. Onde vive o schema e os arquivos

- **Decision**: DDL `memories` em `SqliteOpsStore.initializeSchema()`. Implementação em `src/memory-store.ts` (pedido). Embeddings em `src/memory/embeddings.ts`. `SqliteMemoryStore` recebe `DatabaseSync` (+ `Embedder` opcional para testes com vetores fake).
- **Rationale**: Mesmo padrão da conversa (db compartilhado); caminhos invariantes da spec.
- **Alternatives considered**: (a) colocar store em `src/store/` — diverge do pedido; (b) segundo arquivo SQLite — viola constituição / spec.

## R6. Colisão de nome `buildMemoryStore`

- **Decision**: Manter `buildMemoryStore()` legado (AlertStore in-memory). Novo tipo se chama `MemoryStore` (semântico). Factory: `getDefaultSemanticMemoryStore()` ou `getDefaultMemoryStore()` documentando a diferença no JSDoc. Não renomear o legado nesta feature.
- **Rationale**: Escopo mínimo; evitar quebrar bench/testes que importam o nome antigo.
- **Alternatives considered**: renomear legado para `buildAlertMemoryStore` — churn fora do escopo.

## R7. Integração no chat / composição

- **Decision**: Estender `ChatTurnInput` com `memories?: readonly string[]` (só fatos, já filtrados). `composeChatPrompt` / prefixo estável:

  ```text
  Memórias relevantes:
  - <fact>
  - <fact>

  Histórico da conversa:
  ...
  Mensagem atual:
  <message>
  ```

  Se `memories` vazio/ausente: omitir o bloco (comportamento atual quando só há histórico/mensagem). `runChat`: se `userId` presente e `memoryStore` injetado → `recall(userId, message)` → passar fatos; senão pular. Métrica `recalledMemories: number` (length do recall) mergeada como `historyMessages`.
- **Rationale**: Estratégias que usam `composeChatPrompt` / `toAgentMessages` herdam o contexto; DI permite fake sem modelo.
- **Alternatives considered**: (a) tool do agente para recall — fora do “injeta no prompt”; (b) system message LangChain separada — muda mais estratégias.

## R8. Testes e rede do modelo

- **Decision**: Teste P1 (sem palavra em comum) usa embedder **real** + SQLite `:memory:` (timeout generoso). Testes de dedup/top-k podem usar `Embedder` fake com vetores ortogonais/quase-iguais para asserts determinísticos sem HF. `/chat` usa fake `MemoryStore` (recall fixo). Documentar no quickstart que a 1ª execução pode baixar o modelo (cache Hugging Face).
- **Rationale**: FR-011 permite download do modelo; chat permanece sem rede LLM.
- **Alternatives considered**: só fake no recall semântico — não prova o critério de aceite central.

## R9. Validação HTTP de `userId`

- **Decision**: `userId: z.string().trim().min(1).optional()` no schema strict de `/chat`. Ausente → sem recall. Presente vazio → 400 issues Zod. Sem autenticação (assumptions).
- **Rationale**: Não quebra clientes da 007; alinhado a `conversationId`.
- **Alternatives considered**: `userId` obrigatório — breaking change.
