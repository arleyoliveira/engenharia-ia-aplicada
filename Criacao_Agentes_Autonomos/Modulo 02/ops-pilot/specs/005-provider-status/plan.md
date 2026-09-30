# Implementation Plan: Status de provedores externos

**Branch**: `005-provider-status` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

## Summary

Adicionar a ferramenta `check_provider_status` ao conjunto operacional do agente, consultando as status pages públicas (Statuspage.io) de GitHub e Cloudflare sem autenticação. A consulta usa timeout de 5s, uma retentativa em falha de rede/5xx, validação Zod do payload mínimo e retorno compacto (ou erro legível como observação). Fetch é injetável para testes determinísticos sem rede.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: `@langchain/core` (`tool`), Zod 4, `fetch` nativo + `AbortSignal.timeout`

**Storage**: N/A (consulta HTTP pública; sem persistência)

**Testing**: `node:test` via `tsx`; fake fetch injetável (sucesso, timeout, payload inválido, retry 5xx)

**Target Platform**: Agente OpsPilot (CLI/HTTP já existentes)

**Project Type**: Backend / tooling de agente

**Performance Goals**: Cada tentativa ≤ 5s; no máximo 2 tentativas (≈10s pior caso) por chamada da tool

**Constraints**: Sem chave de API; erros nunca escapam da tool; retorno em uma linha; validação Zod na fronteira da resposta externa; descrição com as 6 regras / quando usar

**Scale/Scope**: 2 provedores (`github`, `cloudflare`); 1 tool; 1 módulo de serviço + testes; sem UI/HTTP novo

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: lógica de consulta/parse em `src/services/provider-status.ts`; tool em `src/agents/tools.ts` só adapta I/O do agente.
- [x] **II. Validação na fronteira**: `provider` com Zod enum; payload externo validado com Zod antes do resumo.
- [x] **III. Erros de domínio**: falhas finais viram string/observação na tool (sem throw para fora); alinhado a FR-009.
- [x] **IV. Teste é parte da tarefa**: testes com fake fetch cobrem sucesso, timeout e inválido.
- [x] **V. Segurança por padrão**: sem segredos; URLs públicas fixas; sem dotenv.
- [x] **VI. Spec antes do código**: spec + este plano antes de implementar.
- [x] **VII. Persistência**: N/A — feature não toca SQLite.

## Project Structure

### Documentation (this feature)

```text
specs/005-provider-status/
├── checklists/requirements.md
├── contracts/check-provider-status.md
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
│   ├── tools.ts                 # registra check_provider_status (+ deps opcionais de fetch)
│   └── tools.test.ts            # regressão das tools existentes + smoke da nova tool
├── services/
│   ├── provider-status.ts       # mapa de URLs, fetch+retry+Zod+resumo compacto
│   └── provider-status.test.ts  # fake fetch: sucesso, timeout, inválido, retry
└── errors.ts                    # reuso de DomainError se útil na borda interna
```

**Structure Decision**: Projeto único. Extrair a consulta para `src/services/provider-status.ts` (efeito de rede na borda de serviço) e expor via tool LangChain em `src/agents/tools.ts`, mantendo `createOpsTools` com injeção opcional de `fetch`.

## Phase 0: Research

Decisões em [research.md](research.md): serviço dedicado + fetch injetável; política de retry; formato de retorno em uma linha; integração no array de tools existente.

## Phase 1: Design & Contracts

- Tipos e fluxos: [data-model.md](data-model.md)
- Contrato da tool: [contracts/check-provider-status.md](contracts/check-provider-status.md)
- Validação executável: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Implementar `src/services/provider-status.ts` (mapa de provedores, timeout 5s, retry único rede/5xx, Zod, resumo compacto).
2. Escrever `src/services/provider-status.test.ts` com fake fetch (sucesso, timeout, inválido, retry).
3. Registrar `check_provider_status` em `src/agents/tools.ts` com descrição orientada a quando usar e schema Zod (`provider` enum + default + `.describe()`).
4. Atualizar `src/agents/tools.test.ts` para incluir a nova tool no conjunto e smoke de descrição/schema.
5. Rodar `npm run typecheck` e `npm run test`.

## Complexity Tracking

Nenhuma violação constitucional requer justificativa.
