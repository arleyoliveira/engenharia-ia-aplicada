# Implementation Plan: Resiliência de modelo

**Branch**: `014-model-resilience` | **Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-model-resilience/spec.md`

## Summary

A fábrica em `src/agents/model.ts` passa a devolver uma fachada. Cada `invoke`, `bindTools` e `withStructuredOutput` monta `primário.withRetry({ stopAfterAttempt: 3 })` e, se `OPENROUTER_MODEL_FALLBACK` estiver definido, `withFallbacks([reserva])` com a mesma configuração e uma única tentativa. A reserva, ao responder, registra um evento `fallback`. `runChat` anexa esses eventos ao trace e preenche `metrics.fallbacks`. Cadeia esgotada vira `ModelUnavailableError` e `POST /chat` responde `503`. Testes com runnables fake, sem rede.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: `@langchain/openai` (`ChatOpenAI`), `@langchain/core` (`withRetry`, `withFallbacks`, `RunnableLambda`), Express, Zod; env nativo do Node (sem dotenv)

**Storage**: N/A (sem DDL; coletor só no turn)

**Testing**: `node:test` + `tsx`; cadeia com `RunnableLambda` fake; HTTP com erro de domínio injetado; sem OpenRouter

**Target Platform**: Serviço HTTP OpsPilot e arena/CLI no mesmo processo

**Project Type**: Backend / web-service (extensão da fábrica de 001 e do `POST /chat`)

**Performance Goals**: No máximo 3 chamadas ao primário e 1 à reserva por invocação de modelo; sem chamada extra quando o primário acerta de primeira

**Constraints**: Reserva opcional; retry só no primário; `503` só para cadeia esgotada; `504` e `ConfigError` intactos; aprendizado fora do turn; typecheck e testes verdes

**Scale/Scope**: Fachada + erro de domínio + coletor no `runChat` + ramo de trace/métrica + mapeamento HTTP; call sites de `createModel()` permanecem

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: composição da cadeia e leitura de env ficam na fábrica (`src/agents/model.ts`), borda do modelo. `runChat` só abre o coletor e anexa o que já foi registrado. O HTTP traduz o erro de domínio; não implementa retry.
- [x] **II. Validação na fronteira**: body do `/chat` não muda. `OPENROUTER_MODEL_FALLBACK` em branco é “ausente”, não um identificador inválido atravessando a cadeia.
- [x] **III. Erros de domínio**: `ModelUnavailableError` com código `MODEL_UNAVAILABLE`. A borda HTTP mapeia para `503` sem stack. A fachada não devolve a exceção crua do provedor.
- [x] **IV. Teste é parte da tarefa**: quatro cenários da cadeia sem rede, `503` no HTTP, métrica/trace no turn, `formatTrace`. `npm run typecheck` e `npm run test` verdes.
- [x] **V. Segurança por padrão**: sem segredo novo; `.env` continua fora do git; só `.env.example` ganha a chave vazia. Sem dotenv.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência**: nenhum store novo.

## Project Structure

### Documentation (this feature)

```text
specs/014-model-resilience/
├── checklists/requirements.md
├── contracts/
│   ├── chat-http.md
│   └── model-factory.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── model.ts                 # fachada: withRetry + withFallbacks; coletor
│   ├── model.test.ts            # NOVO: fakes dos 4 cenários
│   ├── types.ts                 # TraceEvent "fallback"; Metrics.fallbacks
│   ├── trace.ts                 # formatTrace / summarizeMetrics
│   └── trace.test.ts            # ramo fallback
├── errors.ts                    # ModelUnavailableError
├── services/
│   ├── run-chat.ts              # abre coletor; anexa trace; metrics.fallbacks
│   └── run-chat.test.ts         # fallbacks 0 e N
├── graph/
│   └── production-Graph.ts      # repropagar ModelUnavailableError no roteador
├── http/
│   ├── server.ts                # 503
│   └── server.test.ts           # 503; 504 intacto
└── .env.example                 # OPENROUTER_MODEL_FALLBACK=
```

**Structure Decision**: Projeto único. A cadeia mora na fábrica porque todo call site já usa `createModel()`. A fachada existe para `bindTools` e `withStructuredOutput` continuarem válidos em cima de `withFallbacks` (research R1). O coletor fica em `runChat` para somar sumarizador, roteador, estratégia e crítico num único `metrics.fallbacks`.

## Phase 0: Research

Decisões em [research.md](research.md): fachada em volta do runnable configurado; 3 tentativas explícitas; corte entre falha do runnable e validação posterior; coletor ALS; `503` e rethrow no roteador; testes com fakes; `llmCalls` inalterado.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/model-factory.md](contracts/model-factory.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. `ModelUnavailableError` em `src/errors.ts`.
2. Tipos `fallback` / `Metrics.fallbacks`; `formatTrace` e `summarizeMetrics`.
3. `createResilientRunnable` + fachada `createModel` (`stopAfterAttempt: 3`, reserva opcional, registro só após sucesso, erro de domínio se a cadeia cair). Testes fake dos quatro cenários.
4. Coletor ALS: `runChat` abre em volta do sumarizador e do grafo, anexa eventos, define `metrics.fallbacks`. Aprendizado permanece fora. Teste 0 e N.
5. Roteador: `ModelUnavailableError` sobe direto, sem virar `ModelOutputError` e sem segunda volta.
6. `POST /chat`: `503` com `{ error: { code, message } }`. Teste de status; regressão do `504`.
7. `.env.example`: `OPENROUTER_MODEL_FALLBACK=`.
8. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional. A fachada não é camada extra de domínio: é o único jeito de cumprir `withRetry` / `withFallbacks` sem perder `bindTools` e saída estruturada.
