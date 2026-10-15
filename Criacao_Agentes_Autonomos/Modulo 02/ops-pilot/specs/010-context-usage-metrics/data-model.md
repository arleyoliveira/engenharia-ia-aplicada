# Data Model: Medição de contexto do chat

**Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

Sem persistência nova. As entidades são valores de resposta e funções puras.

## Entidades

### TokenEstimate

Inteiro ≥ 0. Para um texto `text`:

```text
estimateTokens(text) = floor(text.length / 4)
```

`text.length` é o comprimento da string em JavaScript (unidades de código), não bytes UTF-8.

### ContextBreakdown

```text
ContextBreakdown = {
  message: number    // estimateTokens(mensagem atual)
  history: number    // Σ estimateTokens(content) das mensagens injetadas
  memories: number   // Σ estimateTokens(fact) dos fatos injetados
}
```

Fontes vazias (sem histórico, sem recall, string vazia) valem `0`. A soma das três fontes não é invariante de `promptTokens`.

Entrada da função pura:

```text
estimateContextBreakdown({
  message: string
  history: readonly { content: string }[]
  memories: readonly string[]
}) => ContextBreakdown
```

O histórico é o já janelado (`HISTORY_WINDOW`) e **não** inclui a mensagem deste turn.

### TurnPromptUsage

```text
promptTokens = Σ promptTokensFromLlmEnd(llmEnd)   // uma contribuição por chamada
```

`promptTokensFromLlmEnd` devolve um inteiro ≥ 0 por `handleLLMEnd`:

| Prioridade | Campo | Regra |
|---|---|---|
| 1 | `llmOutput.tokenUsage.promptTokens` | Usar se finito e ≥ 0. Não somar com os campos abaixo. |
| 2 | `generations[0][0].message.usage_metadata.input_tokens` | Só a primeira generation. |
| 3 | `generations[0][0].message.response_metadata.tokenUsage.promptTokens` | Fallback OpenAI. |
| 4 | ausente / inválido | `0` |

Não usar `llmOutput.estimatedTokenUsage`. Não falhar o turn.

### ChatMetrics (extensão)

Campos já existentes permanecem. Dois campos passam a ser obrigatórios no `200` de `/chat` (preenchidos em `runChat`, não no request):

```text
Metrics = {
  llmCalls: number
  latencyMs: number
  historyMessages?: number          // já obrigatório no 200
  recalledMemories?: number         // já obrigatório no 200
  promptTokens?: number             // obrigatório no 200; default 0 se a estratégia omitir
  contextBreakdown?: ContextBreakdown  // obrigatório no 200
}
```

Estratégias internas podem omitir `promptTokens` e `contextBreakdown`. A borda do chat normaliza `promptTokens` para `0` e sempre calcula o breakdown.

## Relações

```text
ChatTurn
  message ──────────────► ContextBreakdown.message
  history (janela) ─────► ContextBreakdown.history
  memories (recall) ────► ContextBreakdown.memories
  chamadas LLM do turn ─► promptTokens
       ├─ estratégia (ReAct / plan-and-execute, inclusive tools)
       └─ crítico, se reflect=true
  refletor de aprendizado (009) ─ não entra
```

## Transições

Não há estado persistido. Por turn bem-sucedido:

1. Carregar histórico e recall (como hoje).
2. Executar a estratégia; o callback acumula `promptTokens`.
3. Se houver reflexão, somar as voltas da base e as chamadas do crítico.
4. Responder `200` com `promptTokens` e `contextBreakdown` junto das métricas atuais.

Turn com erro (400, 404, 422, 504) não carrega essas métricas.

## Validação

| Entrada | Regra |
|---|---|
| Texto da estimativa | Qualquer string; vazio → 0. Sem trim: espaços contam caracteres. |
| Usage | Só número finito ≥ 0; senão aquela fonte vale 0. Não inteiro finito ≥ 0 → `floor`. |
| Request `/chat` | Schema Zod atual, strict. Nenhum campo novo. |
| Response `200` | `promptTokens` inteiro ≥ 0; `contextBreakdown` com as três chaves inteiras ≥ 0. |
