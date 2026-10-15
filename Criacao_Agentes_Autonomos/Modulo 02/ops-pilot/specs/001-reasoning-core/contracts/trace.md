# Contract: ReasoningStrategy, trace e métricas

## ReasoningStrategy

```typescript
interface ReasoningStrategy {
  readonly name: string;
  run(input: string, options?: { maxIterations?: number }): Promise<StrategyResult>;
}
```

- `run` nunca lança para falhas previsíveis de iteração: ao atingir `maxIterations`, retorna `answer` indicando o limite e o trace termina com evento `critique` registrando o encerramento (FR-010).
- Erros de configuração (`ConfigError` na fábrica de modelo) sobem até a borda (arena) que os traduz em mensagem + exit code não-zero.

## Trace

Sequência ordenada de `TraceEvent` (união discriminada fechada):

| Tipo | Campos | Origem típica |
|------|--------|---------------|
| `thought` | `content` | Texto intermediário do modelo |
| `plan` | `steps: string[]` | Planner / replanner (Plan-and-Execute) |
| `action` | `tool`, `args` | Chamada de ferramenta decidida pelo agente |
| `observation` | `content` | Resultado (ou erro) da ferramenta |
| `critique` | `content` | Revisão do replanner; também usado no encerramento por limite |
| `answer` | `content` | Resposta final |

Regras:
- Todo `action` carrega `tool` e `args` (FR-002).
- O trace sempre termina com exatamente um evento `answer`.
- `formatTrace(trace)` (função pura em `src/agents/trace.ts`) produz texto estável, uma linha por evento: `[plan] step 1..N`, `[action] tool(args)`, etc. — determinística, alvo dos testes sem rede.

## Métricas

```typescript
type Metrics = { llmCalls: number; latencyMs: number };
```

- `llmCalls`: contagem real de invocações ao modelo (callback `handleLLMStart`), incluindo planner/executor/replanner — invariante SC-006.
- `latencyMs`: tempo de parede do `run()` (`performance.now()`), inteiro em ms.

## StrategyResult

```typescript
type StrategyResult = { answer: string; trace: TraceEvent[]; metrics: Metrics };
```

Estratégias registradas na arena: `react`, `plan-and-execute`.
