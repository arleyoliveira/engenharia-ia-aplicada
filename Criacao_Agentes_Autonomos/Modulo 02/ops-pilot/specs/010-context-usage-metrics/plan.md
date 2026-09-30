# Implementation Plan: Medição de contexto do chat

**Branch**: `010-context-usage-metrics` | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-context-usage-metrics/spec.md`

## Summary

Cada `POST /chat` bem-sucedido passa a informar o tamanho real do prompt (`metrics.promptTokens`, soma do usage de entrada do LangChain no turno) e uma estimativa por fonte (`metrics.contextBreakdown`: mensagem, histórico, memórias) com `floor(caracteres/4)`. O script de conversa longa já imprime `promptTokens` por turno; a API é que passa a preencher o campo. Testes sem rede.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: LangChain (`@langchain/core` callback `handleLLMEnd`, `@langchain/openai` `usage` → `tokenUsage.promptTokens` / `usage_metadata.input_tokens`), Express, Zod (request inalterado)

**Storage**: N/A (métricas só na resposta; sem DDL)

**Testing**: `node:test` + `tsx`; fixtures de `LLMResult`; estratégia e modelo fakes; sem OpenRouter

**Target Platform**: Serviço HTTP OpsPilot (mesmo processo)

**Project Type**: Backend / web-service (extensão de 003/007/008/009)

**Performance Goals**: Leitura de usage e estimativa no caminho do turn sem chamada extra de modelo e sem esperar o refletor de aprendizado

**Constraints**: MVC; estimativa pura; usage ausente vira `0` e não falha o turn; não igualar breakdown ao total real; contratos HTTP de erro inalterados

**Scale/Scope**: 1 módulo puro + extensão do contador de LLM + merge em `runChat` + três estratégias que já emitem métricas; script existente só é conferido

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: `estimateTokens`, breakdown e parser de usage são funções puras em `src/context/tokens.ts`. O callback fica na borda do agente (`metrics.ts`). `runChat` só faz merge. HTTP não calcula tokens.
- [x] **II. Validação na fronteira**: request Zod inalterado. O parser aceita só número finito ≥ 0; o resto conta como usage ausente, sem atravessar dado inválido como métrica.
- [x] **III. Erros de domínio**: falta de usage não é erro de domínio nem de transporte. Erros HTTP existentes permanecem.
- [x] **IV. Teste é parte da tarefa**: piso, breakdown, parser, callback, `runChat`, HTTP e soma na reflexão; `npm run typecheck` e `npm run test` verdes.
- [x] **V. Segurança por padrão**: sem segredo novo, sem `.env`, sem dotenv.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência**: nenhum store novo; testes não abrem arquivo de banco para esta feature.

## Project Structure

### Documentation (this feature)

```text
specs/010-context-usage-metrics/
├── checklists/requirements.md
├── contracts/chat-http.md
├── contracts/context-metrics.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── context/
│   ├── tokens.ts                 # NOVO: estimateTokens, estimateContextBreakdown, promptTokensFromLlmEnd
│   └── tokens.test.ts            # NOVO
├── agents/
│   ├── metrics.ts                # promptTokens no createLlmCallCounter (handleLLMEnd)
│   ├── metrics.test.ts           # NOVO
│   ├── types.ts                  # Metrics.promptTokens?, contextBreakdown?
│   ├── react.ts                  # metrics.promptTokens = counter.promptTokens
│   ├── plan-and-execute.ts       # idem
│   ├── reflection.ts             # soma base + crítico
│   ├── reflection.test.ts        # soma / passthrough
│   └── trace.ts                  # summarizeMetrics inclui promptTokens se presente
├── services/
│   ├── run-chat.ts               # merge promptTokens ?? 0 + contextBreakdown
│   └── run-chat.test.ts
├── http/
│   └── server.test.ts            # 200 traz os dois campos
└── scripts não se aplica
scripts/
└── conversa-longa.sh             # já imprime .metrics.promptTokens; não mudar o fallback
```

**Structure Decision**: Projeto único. Estimativa e parser ficam em `src/context/tokens.ts` (pedido). O contador que já existe em `src/agents/metrics.ts` passa a somar usage, porque é ele que as estratégias registram no `invoke`. `runChat` é o único lugar que conhece mensagem, histórico janelado e memórias, então é ele que preenche `contextBreakdown`.

## Phase 0: Research

Decisões em [research.md](research.md): piso por fonte; um inteiro por `handleLLMEnd` sem dupla contagem; agregação no contador e na reflexão; breakdown no `runChat`; refletor de aprendizado de fora; script já conforme.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/context-metrics.md](contracts/context-metrics.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. `estimateTokens` + `estimateContextBreakdown` + `promptTokensFromLlmEnd` em `src/context/tokens.ts`, com testes de piso, fontes vazias e fixtures de usage (incluindo “não somar tokenUsage com usage_metadata” e “ignorar estimatedTokenUsage”).
2. Estender `Metrics` e `createLlmCallCounter` (`promptTokens` via `handleLLMEnd`). Teste do handler com dois ends.
3. Gravar `metrics.promptTokens` em `react` e `plan-and-execute`. Em `withReflection`, somar as bases e o contador do crítico; cobrir no teste fake (o model fake chama `handleLLMEnd` quando houver fixture).
4. Em `runChat`, merge `promptTokens ?? 0` e `contextBreakdown` a partir da mensagem, do histórico pré-append e dos fatos do recall. Asserts em `run-chat.test.ts` e `server.test.ts`.
5. Incluir `promptTokens` em `summarizeMetrics` quando o campo existir (mesmo padrão de `historyMessages`).
6. Conferir que `scripts/conversa-longa.sh` continua lendo `.metrics.promptTokens // "n/a"`. Sem mudança de formato.
7. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional. Nota: o usage real depende do provedor devolver `usage` no protocolo OpenAI (OpenRouter via `ChatOpenAI`). Ausência vira `0`, que é o contrato, não um fallback estimado.
