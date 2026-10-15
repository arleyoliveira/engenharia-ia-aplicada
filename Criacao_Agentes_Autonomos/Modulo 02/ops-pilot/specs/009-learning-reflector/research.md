# Research: Refletor de aprendizado

**Date**: 2026-09-18 | **Feature**: [spec.md](spec.md)

Nenhuma pendência NEEDS CLARIFICATION no Technical Context. Decisões alinhadas à spec, constituição e ao padrão `runChat` + `withStructuredOutput` (reflection/plan-and-execute).

## R1. Onde pendurar o gancho

- **Decision**: Em `runChat`, **após** `strategy.run` e append do assistant, **antes** do `return`: se `input.userId` e `deps.memory`, disparar `void learnFromUserMessage(...).catch(() => log)`. **Não** `await` o aprendizado.
- **Rationale**: Único orquestrador pós-sucesso; HTTP devolve assim que `runChat` resolve, enquanto `remember`/embedding seguem em background.
- **Alternatives considered**: (a) no handler HTTP após `res.json` — mais tarde, fácil esquecer outros callers; (b) decorator de estratégia — acopla todas as estratégias.

## R2. Contrato do structured output

- **Decision**: Zod:

  ```ts
  z.object({
    hasLearning: z.boolean(),
    fact: z.string(),
  })
  ```

  Prompt de sistema explícito: gravar só preferências/restrições duráveis; `hasLearning=false` para pedidos pontuais e para qualquer segredo; `fact` em 1 frase curta, sem credenciais.
- **Rationale**: Pedido do usuário; espelha `critiqueSchema` / `withStructuredOutput(..., { method: "functionCalling" })`.
- **Alternatives considered**: enum de categorias — overkill para v1.

## R3. Pós-filtro defensivo (além do modelo)

- **Decision**: Antes de `remember`, aplicar checagens determinísticas: `hasLearning === true`; `fact.trim().length > 0`; rejeitar se `fact` (ou mensagem) casar heurística de segredo (`api[_-]?key`, `password`, `secret`, `token`, `sk-[a-zA-Z0-9]`, etc.).
- **Rationale**: Modelo pode alucinar; constituição V exige segurança por padrão.
- **Alternatives considered**: só confiar no prompt — insuficiente.

## R4. Assíncrono / testabilidade

- **Decision**: Função `scheduleLearning(task: () => Promise<void>)` default = `void task().catch(...)`. Em testes, injetar scheduler que registra a Promise (ou executa sync) para asserts; teste de não-bloqueio: `remember` com deferred que só resolve depois — `runChat` deve retornar antes do resolve.
- **Rationale**: SC-004 mensurável sem flakiness de timing real de embedding.
- **Alternatives considered**: sempre await em test env via flag — mascara o bug de bloqueio em prod.

## R5. Tool `forget_preference`

- **Decision**: Schema `{ preference: string }` (trim, min 1). Implementação: `recall(userId, preference)` → se vazio, retorno JSON `{ forgotten: false, reason: "not_found" }`; senão `forget(userId, hits[0].id)` no melhor hit (já filtrado ≥ 0,3) → `{ forgotten: true, fact, id }`.
- **Rationale**: Usuário fala em linguagem natural (“esqueca o idioma das notificações”); não precisa conhecer UUID; reusa ranking 008.
- **Alternatives considered**: (a) só `id` — ruim UX do agente; (b) apagar todos os top-3 — agressivo demais.

## R6. Injeção de `userId` na tool

- **Decision**: Factory por turn: `createForgetPreferenceTool({ memory, userId })` fecha sobre o `userId` do request. `runChat` monta `const memoryTools = userId && memory ? [forgetTool] : []` e chama `strategy.run(turnInput, { tools: await mergeOpsAndMemoryTools(memoryTools) })`.
- **Rationale**: Estratégias já preferem `options.tools`; evita AsyncLocalStorage.
- **Alternatives considered**: tool global lendo header — não há auth; frágil.

## R7. Merge com ops tools

- **Decision**: Se `options.tools` for passado só com memory tools, ReAct perderia ops tools. Portanto `runChat` deve passar **ops + forget** quando houver memória: `tools = [...(await createDefaultOpsTools()), forgetTool]`, ou aceitar `deps.baseTools` injetável nos testes.
- **Rationale**: Produção continua com list_alerts etc.; testes injetam lista mínima.
- **Alternatives considered**: patch dentro de `createDefaultOpsTools` com singleton userId — race entre requests.

## R8. Dependência de modelo em produção

- **Decision**: Default `createModel()` + `withStructuredOutput`; deps `LearningReflectorDeps { distill?: (msg) => Promise<LearningReflection> }` para testes sem rede.
- **Rationale**: Mesmo stack OpenRouter; FR-008 exige fakes.
- **Alternatives considered**: regras só por regex — não destila fato; fora do pedido.
