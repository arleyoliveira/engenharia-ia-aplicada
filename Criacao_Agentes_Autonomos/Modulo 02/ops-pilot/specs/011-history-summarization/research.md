# Research: Sumarização de histórico (pruning)

**Date**: 2026-09-22 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição VII e o pipeline atual de `runChat` + `ConversationStore`.

## R1. Cursor do que já foi sumarizado

- **Decision**: Persistir em `conversation_summaries` o campo `covered_through_message_id` (INTEGER, FK lógica ao último `messages.id` absorvido pelo resumo vigente). Elegibilidade: mensagens com `id > covered_through_message_id` **e** `id <` id da mensagem mais antiga da janela crua atual. Consolidar só quando essa lista tiver length ≥ `PRUNE_BATCH_SIZE` (8); consumir exatamente as 8 mais antigas do conjunto.
- **Rationale**: Define “8 novas saíram da janela” sem reprocessar o histórico inteiro e sem sumarizar a cada request. Reinício do processo reutiliza o cursor.
- **Alternatives considered**: (a) contar só `total - 8 - lastSummarizedCount` em memória de processo — perde no restart; (b) sumarizar sempre que `total > 8` a cada turn — viola FR-006; (c) apagar mensagens podadas — fora de escopo e impede auditoria.

## R2. Onde vive o schema e a API de resumo

- **Decision**: DDL de `conversation_summaries` no `ensureSchema` do `SqliteOpsStore` (mesmo `DatabaseSync`). Estender `ConversationStore` com `getSummary(conversationId)`, `upsertSummary(conversationId, { text, coveredThroughMessageId })` e `messagesBefore(conversationId, beforeIdExclusive, afterIdExclusive, limit)` (ordem cronológica crescente). Implementações: `SqliteConversationStore` + `MemoryConversationStore`.
- **Rationale**: Um resumo por conversa; mesmo padrão 007 (store de conversa separado, schema no ops store); testes fake sem SQL.
- **Alternatives considered**: (a) `SummaryStore` paralelo — DI extra sem ganho; (b) coluna em `conversations` — menos explícito que a tabela pedida na spec.

## R3. Janela crua 8 (substitui 12)

- **Decision**: `HISTORY_WINDOW = 8` em `compose-chat-prompt.ts`. `runChat` continua `lastMessages(id, HISTORY_WINDOW)` **antes** do append do user. `historyMessages` = `history.length` (0..8).
- **Rationale**: Spec FR-001 / FR-011; um único knocker evita drift entre HTTP e composição.
- **Alternatives considered**: manter 12 e sumarizar só o excedente além de 8 — contradiz o pedido explícito de 8 recentes.

## R4. Momento da consolidação no turn

- **Decision**: Em `runChat`, **antes** de `strategy.run` (e antes do append do user, após carregar a janela):
  1. `history = lastMessages(8)`
  2. `prior = getSummary()`
  3. candidatos = `messagesBefore(oldestInWindow.id, after=covered)` (se janela cheia; senão nenhum)
  4. se `candidatos.length >= 8` → `summarizer.summarize({ previous: prior?.text, batch: candidatos.slice(0,8) })` → `upsertSummary` → `didSummarize=true`
  5. `summaryText = novo || prior?.text`
  6. recall / append user / `strategy.run({ ..., summary })` / append assistant
  7. se `didSummarize`, `trace = [{ type: "summarize", content }, ...result.trace]`
- **Rationale**: O turn elegível já vê o resumo atualizado; request intermediário só lê. Append do user depois evita que a mensagem atual entre no lote podado.
- **Alternatives considered**: consolidar depois da resposta — atrasa o benefício um turn; consolidar async fire-and-forget — race e viola “persistido antes de reutilizar”.

## R5. Sumarizador (prod vs fake)

- **Decision**: Interface `HistorySummarizer { summarize(input: { previous?: string; batch: ConversationMessage[] }): Promise<string> }`. Fake determinístico para testes (texto estável citando papéis/conteúdos e eixos decisão/fato/pendência quando marcadores existirem; comprimento compatível com ~150 via `estimateTokens`). Produção: uma chamada de modelo com system/user prompt pedindo mescla preservando decisões, fatos e pendências, alvo ~150 tokens; resultado trimado.
- **Rationale**: Spec exige teste fake sem rede; DI espelha `learning` em `RunChatDeps`.
- **Alternatives considered**: (a) extrativo sem LLM — frágil para “decisões/pendências”; (b) sumarizar só o lote e concatenar ao anterior sem recomprimir — estoura o contexto ao longo do plantão.

## R6. Alvo ~150 tokens

- **Decision**: Constante `SUMMARY_TARGET_TOKENS = 150`. Prompt de produção pede esse alvo; fake gera texto com `estimateTokens(text) ≈ 150` (tolerância de teste, ex. 120..180). Não há hard-truncate cego que destrua o sentido — se o modelo estourar levemente, aceitar; plano de tasks pode opcionalmente truncar por sentença só se necessário nos testes de contrato.
- **Rationale**: Spec usa “~150”; a estimativa do projeto já é `floor(chars/4)`.
- **Alternatives considered**: hard cap por caracteres no meio da palavra — pior UX no prompt.

## R7. Injeção no contexto

- **Decision**: `ChatTurnInput.summary?: string`. Em `composeChatPrompt` / `toAgentMessages`, se presente e não vazio, prefixar bloco:

  ```text
  Resumo da conversa:
  <summary>

  ```

  depois memórias (se houver) e histórico/mensagem atual (formato atual). `normalizeChatTurnInput` propaga `summary`.
- **Rationale**: Mesmo padrão do bloco de memórias; estratégias não precisam de API nova além do campo no turn.
- **Alternatives considered**: summary só em system message LangChain — divergiria entre ReAct e plan-and-execute.

## R8. Evento `summarize`

- **Decision**: Estender `TraceEvent` com `{ type: "summarize"; content: string }` (`content` = texto do resumo vigente após a mescla, ou nota curta + resumo). Emitir **somente** no turn em que `didSummarize === true`, prepend no array devolvido por `runChat`. `formatEvent` renderiza `[summarize] ...`.
- **Rationale**: FR-008; o núcleo das estratégias não precisa saber de pruning.
- **Alternatives considered**: métrica booleana `summarized` sem evento — não atende o pedido de evento nomeado.

## R9. `contextBreakdown.summary`

- **Decision**: Estender breakdown com `summary: number` = `estimateTokens(summaryText ?? "")`. `history` continua só contents das até 8 mensagens cruas. Clientes antigos que só leem as três chaves seguem válidos (campo novo aditivo).
- **Rationale**: Observabilidade alinhada a 010 sem misturar resumo com histórico cru.
- **Alternatives considered**: somar summary em `history` — esconde a fonte; omitir — breakdown subconta o contexto montado.

## R10. Mensagens no “limbo” (< 8 fora da janela)

- **Decision**: Confirmar a assumption da spec: mensagens já fora das 8 recentes mas ainda não cobertas pelo cursor **não** entram no prompt cru até fechar o lote. Continuidade via resumo anterior (se houver) + janela.
- **Rationale**: Evita custo a cada request e mantém FR-006 simples.
- **Alternatives considered**: injetar limbo cru temporário — re-infla o prompt e complica o contrato da janela.

## R11. Falha na consolidação

- **Decision**: Se o turn é elegível e `summarize` ou `upsertSummary` falha, propagar erro (domínio/borda); não devolver 200 com trace sem consolidação obrigatória daquele lote. O cursor permanece no valor anterior → retentativa no próximo turn elegível (mesmo lote).
- **Rationale**: Edge case da spec; evita drift silencioso.
- **Alternatives considered**: degradar e seguir só com janela — mascararia perda de contexto longo.

## R12. Wiring de produção

- **Decision**: `RunChatDeps.summarizer?: HistorySummarizer`. Ausente ⇒ comportamento de só janela (útil em testes unitários mínimos); composição de produção injeta sumarizador real. HTTP/`createChatServer` pode receber via deps já usadas por `runChat`.
- **Rationale**: Mesmo padrão `learning?` / `memory?`.
- **Alternatives considered**: singleton global — dificulta fake no `server.test.ts`.
