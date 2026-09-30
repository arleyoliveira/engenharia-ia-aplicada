# Research: Resiliência de modelo

**Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

## R1. Onde aplicar `withRetry` e `withFallbacks`

- **Decision**: A fábrica em `src/agents/model.ts` deixa de devolver o `ChatOpenAI` cru. `createModel()` devolve uma fachada com `invoke`, `bindTools` e `withStructuredOutput`. Cada um desses métodos monta o runnable assim: `primárioConfigurado.withRetry({ stopAfterAttempt: 3 }).withFallbacks([reservaConfigurada])` quando `OPENROUTER_MODEL_FALLBACK` está definida e não é só espaços; senão, só `withRetry`. A configuração (tools ou schema) é aplicada **em cada** `ChatOpenAI` antes do retry e do fallback.
- **Rationale**: `withFallbacks` devolve `RunnableWithFallbacks`, que não tem `bindTools`. O ReAct pré-construído chama `bindTools` no LLM; plan-and-execute, roteador, crítico e refletor de aprendizado chamam `withStructuredOutput`. Enrolar o modelo cru quebraria esses call sites. Enrolar o runnable já configurado é o uso previsto da API e faz a reserva receber as mesmas tools/schema.
- **Alternatives considered**: Subclasse de `BaseChatModel` com retry manual (não usa `withRetry`/`withFallbacks`); monkeypatch em `ChatOpenAI.bindTools` (frágil e não cobre `withStructuredOutput` e `invoke`).

## R2. Quantas tentativas

- **Decision**: `stopAfterAttempt: 3` explícito no primário. A reserva é uma única tentativa, sem `withRetry`.
- **Rationale**: É o default atual de `RunnableRetry` (`maxAttemptNumber = 3`). Fixar o número deixa o teste estável se a biblioteca mudar o default. O pedido pede retry só no primário.
- **Alternatives considered**: `withRetry()` sem argumentos (o teste dependeria do default); retry também na reserva (contradiz o pedido).

## R3. O que conta como falha da cadeia

- **Decision**: Qualquer exceção do runnable configurado (rede, HTTP, falha de function-calling / saída estruturada **dentro** do runnable) consome tentativa. Esgotada a cadeia, a fachada lança `ModelUnavailableError` (`MODEL_UNAVAILABLE`), sem anexar stack nem corpo do provedor. Saída que o modelo devolveu e que a aplicação rejeita **depois** do `invoke` (ex.: rota inválida em `acceptVerdict`, texto vazio do sumarizador) continua erro de domínio já existente, não `503`.
- **Rationale**: A spec manda o plano cravar o corte. `withStructuredOutput(..., { method: "functionCalling" })` faz parte do runnable que pode lançar; a reserva precisa do mesmo schema. Validação posterior não é invocação do modelo.
- **Alternatives considered**: Retry só em 429/5xx (a API `withRetry` não filtra por status sem `onFailedAttempt` extra; o pedido não pede esse filtro).

## R4. Evento `fallback` e `metrics.fallbacks`

- **Decision**: A reserva é um `RunnableLambda` que, **depois** de `invoke` bem-sucedido, registra `{ type: "fallback", from, to }` num coletor `AsyncLocalStorage`. `from` é `OPENROUTER_MODEL`; `to` é `OPENROUTER_MODEL_FALLBACK`. `runChat` abre o coletor em volta do sumarizador e do grafo. No `200`, anexa esses eventos ao final de `trace` (ordem de ocorrência entre si) e define `metrics.fallbacks` com o tamanho da lista. Sem coletor ativo, a reserva ainda responde, mas não há onde gravar (testes da cadeia observam o callback injetável).
- **Rationale**: `RunnableWithFallbacks` não emite evento de domínio. Registrar só após sucesso evita contar troca cujo `503` descarta a resposta. Anexar no fim evita enfiar o buffer de trace em cada agente. A spec exige ordem entre os eventos de fallback e igualdade com a métrica, não interleaving com `thought`.
- **Alternatives considered**: Callback `handleLLMStart` comparando o nome do modelo (frágil, conta tentativa falha); evento no meio do trace do ReAct (exige alterar `toTrace`).

## R5. Quem entra no turn e quem fica de fora

- **Decision**: Entram no coletor do `POST /chat`: sumarizador, roteador, estratégia e crítico de reflection. O refletor de aprendizado (009) continua depois do `200`, fire-and-forget: pode usar a mesma fábrica, mas fora do coletor; falha lá não vira `503` nem mexe na métrica já devolvida.
- **Rationale**: Alinhado à spec 010, em que o aprendizado não entra nas métricas do turn.
- **Alternatives considered**: `503` se o aprendizado falhar (atrasa e derruba um turn que já tem resposta).

## R6. `503` na borda e o retry manual do roteador

- **Decision**: `ModelUnavailableError` estende `DomainError`. `POST /chat` responde `503` com `{ error: { code: "MODEL_UNAVAILABLE", message } }`, no mesmo formato do `504` (mensagem sem prefixo `[CODE]`). O laço manual do roteador (hoje até 2 tentativas, depois `ModelOutputError`) MUST repropagar `ModelUnavailableError` na hora, sem embrulhar nem repetir a cadeia. Arena/CLI já traduzem `DomainError` via `toBoundaryMessage` e não imprimem resposta de sucesso.
- **Rationale**: Sem o rethrow, o roteador transformaria indisponibilidade em `ModelOutputError` → `500`, e multiplicaria as 3 tentativas. Timeout segue `ChatTimeoutError` → `504`. `ConfigError` de chave ou `OPENROUTER_MODEL` ausentes não muda.
- **Alternatives considered**: Mapear qualquer exceção não-domínio do chat para `503` (esconderia bugs como `500`).

## R7. Testes sem rede

- **Decision**: A composição (`withRetry` + `withFallbacks` + registro + `ModelUnavailableError`) é testada com `RunnableLambda` fakes, sem `ChatOpenAI`. O HTTP testa `ModelUnavailableError` → `503` com estratégia/grafo fake. `runChat` testa que o coletor anexa o evento e preenche `metrics.fallbacks` (0 quando ninguém registrou). `formatTrace` ganha ramo `fallback` para não cair no default que exige `content`.
- **Rationale**: A spec pede os quatro cenários sem rede. A chamada real ao OpenRouter fica fora da suíte.
- **Alternatives considered**: Mock de `fetch` do OpenRouter (acopla ao formato do provedor e não prova `withFallbacks`).

## R8. `llmCalls` durante o retry

- **Decision**: Não mudar a semântica de `llmCalls`. Cada `handleLLMStart`, inclusive tentativas que falham, continua contando.
- **Rationale**: Fora do pedido. O sinal novo de troca é `metrics.fallbacks`, não uma redefinição de `llmCalls`.
- **Alternatives considered**: Contar só a tentativa que sucedeu (quebra a leitura histórica de “quantas idas ao modelo”).
