# Research: Medição de contexto do chat

**Date**: 2026-09-22 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição e o callback de LLM já usado em `src/agents/metrics.ts`.

## R1. Onde vive a estimativa

- **Decision**: `src/context/tokens.ts` exporta `estimateTokens(text)` = `Math.floor(text.length / 4)` e `estimateContextBreakdown({ message, history, memories })`. Funções puras, sem IO e sem import de LangChain. `history` soma `estimateTokens(content)` de cada mensagem; `memories` soma `estimateTokens(fact)` de cada fato. Rótulos (`user:` / `assistant:`, “Memórias relevantes:”) ficam de fora.
- **Rationale**: Invariante do pedido (`chars/4`, piso). A partição é determinística e testável sem modelo. O piso por item (e não `floor` da concatenação) torna cada fonte verificável sozinha.
- **Alternatives considered**: (a) estimar o prompt formatado inteiro — acopla a métrica ao texto de `composeChatPrompt`; (b) `wc -c` / bytes UTF-8 — diverge de `string.length` e a spec fixa caracteres.

## R2. De onde sai o `promptTokens` real

- **Decision**: Ler o usage no `handleLLMEnd` do callback LangChain já passado às estratégias. Por chamada, um único inteiro, nesta ordem:
  1. `llmOutput.tokenUsage.promptTokens` se for número finito ≥ 0;
  2. senão `usage_metadata.input_tokens` da **primeira** generation (não somar generations: o ChatOpenAI copia o mesmo usage em cada choice);
  3. senão `response_metadata.tokenUsage.promptTokens` da primeira mensagem;
  4. senão `0`.
  Ignorar `llmOutput.estimatedTokenUsage` (estimativa de stream). Número não finito ou negativo conta como ausente (`0`). Não inteiro: `Math.floor` se finito e ≥ 0.
- **Rationale**: `@langchain/openai` `ChatOpenAI` (completions, não-stream) devolve os dois primeiros campos a partir de `usage.prompt_tokens` (`completions.js`). O projeto usa `invoke`, não `stream`. Somar `tokenUsage` **e** `usage_metadata` da mesma chamada contaria duas vezes. OpenRouter fala o protocolo OpenAI via `createModel()`; se o provedor omitir `usage`, a chamada contribui `0` e o turn não falha.
- **Alternatives considered**: (a) somar `AIMessage.usage_metadata` só no array final do ReAct — perde chamadas cujo resultado não fica na mensagem, e o crítico/`withStructuredOutput` devolve o objeto Zod, não o `AIMessage`; (b) `includeRaw: true` em todo structured output — muda o contrato do crítico/planner; (c) tokenizer local como “real” — a spec separa estimativa de usage.

## R3. Quem agrega o turno

- **Decision**: Estender `createLlmCallCounter()` com `promptTokens`. O mesmo `handler` incrementa `calls` em `handleLLMStart` e soma `promptTokensFromLlmEnd` em `handleLLMEnd`. `react` e `plan-and-execute` gravam `metrics.promptTokens = counter.promptTokens`. `withReflection` soma `baseResult.metrics.promptTokens ?? 0` em cada volta e acrescenta o contador do crítico (mesmo handler que já conta `llmCalls`). Ausência do campo na estratégia base vale `0`.
- **Rationale**: O contador já observa cada chamada (ReAct, planner, executor, replanner, crítico) porque esses `invoke` recebem `callbacks: [counter.handler]`. A reflexão hoje reconstrói `metrics` e descartaria `promptTokens` se não somar explícito.
- **Alternatives considered**: (a) contador separado — dois handlers para o mesmo fim; (b) calcular `promptTokens` só no `runChat` — o serviço não vê o `LLMResult`.

## R4. Onde entra o `contextBreakdown`

- **Decision**: `runChat` calcula o breakdown **depois** da estratégia, com a mensagem do turn, o histórico carregado **antes** do append do user atual e os fatos do recall. Faz merge:

  ```text
  promptTokens: result.metrics.promptTokens ?? 0
  contextBreakdown: estimateContextBreakdown(...)
  historyMessages / recalledMemories: inalterados
  ```

  O HTTP só serializa o `ChatOutput`; não há campo novo no request Zod.
- **Rationale**: Mesmo ponto que já define `historyMessages` e `recalledMemories`. Estratégia fake sem usage continua produzindo `promptTokens: 0` e breakdown preenchido. A partição descreve o contexto montado pelo chat, não o prompt reescrito pelo crítico nem as observações de ferramenta.
- **Alternatives considered**: calcular dentro de cada estratégia — duplicaria a regra e as fakes dos testes deixariam o campo de fora.

## R5. O que não entra em `promptTokens`

- **Decision**: Chamadas do refletor de aprendizado (`scheduleLearningRemember`, spec 009) ficam de fora. Elas disparam depois que o `200` já foi determinado e não podem atrasar a resposta. System prompt, tools e observações intermediárias entram no usage real (o provedor conta) mas **não** nas três fontes estimadas. A desigualdade é esperada.
- **Rationale**: Incluir o refletor exigiria await no caminho crítico, o que viola 009. A spec manda somar as chamadas do turn que produzem a resposta (ferramentas e reflexão inclusas).
- **Alternatives considered**: esperar o refletor para fechar a métrica — quebra o `200` não-bloqueante.

## R6. Script de conversa longa

- **Decision**: `scripts/conversa-longa.sh` já imprime `promptTokens` por turno via `jq -r '.metrics.promptTokens // "n/a"'`. Não mudar o formato da linha nem o fallback. A estimativa local `req≈`/`res≈` (`wc -c`) permanece auxiliar e não é o contrato de `promptTokens`.
- **Rationale**: FR-011 já está no script; o buraco é a API não devolver o campo. O ensaio de 30 turnos ao vivo continua fora da suíte (FR-012).
- **Alternatives considered**: falhar o turno quando o campo falta — a spec exige `n/a` e seguir.

## R7. Testes sem rede

- **Decision**:
  - `src/context/tokens.test.ts`: piso (`""` → 0, comprimento &lt; 4 → 0, resto não nulo), breakdown por fonte, fontes vazias, parser de `LLMResult` (tokenUsage, usage_metadata, ausência, não somar os dois, ignorar `estimatedTokenUsage`).
  - `src/agents/metrics.test.ts`: duas chamadas `handleLLMEnd` somam; `handleLLMStart` não mexe em tokens.
  - `run-chat.test.ts` / `server.test.ts`: fake sem usage → `promptTokens === 0` e breakdown coerente com os textos; fake que devolve `promptTokens` → o HTTP repassa a soma.
  - `reflection.test.ts`: somar `promptTokens` das voltas da base; crítico fake que chama `handleLLMEnd` acrescenta os tokens do crítico. Estender o fake model só o necessário.
- **Rationale**: Constituição IV. Nenhum teste chama OpenRouter.
- **Alternatives considered**: teste de integração com modelo real — rede e flakiness; fora do pedido.
