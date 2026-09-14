# Implementation Plan: Camada de Reflection para Estratégias de Raciocínio

**Branch**: `002-reflection-layer` | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-reflection-layer/spec.md`

## Summary

Implementação da camada de reflexão autônoma (`withReflection`) para o OpsPilot, permitindo que qualquer estratégia de raciocínio (`ReasoningStrategy`) seja decorada com validação crítica das respostas geradas frente às observações factuais coletadas pelas ferramentas durante o trace. Em caso de inconsistência ou omissão, a resposta é reprovada e a estratégia base é reexecutada com o feedback corretivo no contexto até atingir aprovação ou o limite configurado (`maxReflections`, default 2). As estratégias decoradas são expostas na CLI da arena (`reflect:react`, `reflect:plan-and-execute`).

## Technical Context

**Language/Version**: Node.js 22 LTS, TypeScript ESM strict

**Primary Dependencies**: LangChain JS (`@langchain/core`, `@langchain/openai`), Zod para saída estruturada (`functionCalling`)

**Storage**: Em memória / sem persistência adicional

**Testing**: `node:test` + `tsx` para testes unitários determinísticos

**Target Platform**: CLI / Terminal

**Project Type**: Agent Reasoning Framework / CLI

**Performance Goals**: Latência minimizada por parada rápida no primeiro `approved === true`; métricas precisas de chamadas LLM e tempo

**Constraints**: Respeitar a constituição do OpsPilot (funções puras, validação de fronteira, sem leitura de `.env`, testes determinísticos)

**Scale/Scope**: Decorador genérico aplicável a 100% das estratégias de raciocínio presentes e futuras

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Camadas explícitas (MVC)**: Reflection opera como decorador funcional puro em `src/agents/reflection.ts`.
- [x] **II. Validação na fronteira**: Saída do crítico validada com Zod (`critiqueSchema`), argumentos CLI validados com Zod.
- [x] **III. Erros de domínio**: Erros estruturados mapeados como `ModelOutputError` e tratados com resiliência.
- [x] **IV. Teste é parte da tarefa**: Suite completa de testes unitários sem rede em `src/agents/reflection.test.ts`.
- [x] **V. Segurança por padrão**: Sem segredos em código, variáveis lidas via ambiente.
- [x] **VI. Spec antes do código**: Fluxo Spec Kit respeitado integralmente.

## Project Structure

### Documentation (this feature)

```text
specs/002-reflection-layer/
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── cli.md
│   └── reflection-api.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code Changes

```text
src/
├── agents/
│   ├── reflection.ts          # Função withReflection, critiqueSchema, extração de observações
│   ├── reflection.test.ts     # Testes determinísticos unitários sem rede
│   └── index.ts (ou types.ts) # Exportação de tipos e helpers da camada de reflexão
└── arena.ts                   # Registro de reflect:react, reflect:plan-and-execute e aliases
```

## Phased Implementation Structure

### Phase 1 - Núcleo da Camada de Reflection
- Criar `src/agents/reflection.ts`:
  - `critiqueSchema` com Zod (`approved`, `feedback`).
  - Função pura `extractObservations(trace: TraceEvent[]): string[]`.
  - Invocação estruturada do crítico com resiliência a falhas de modelo.
  - Função decoradora `withReflection(strategy, options)`.
  - Agregação acumulativa de `llmCalls`, `latencyMs` e eventos `critique` no trace.

### Phase 2 - Testes Unitários e Determinísticos
- Criar `src/agents/reflection.test.ts`:
  - Teste de aprovação direta na 1ª tentativa (1 crítica, 0 regenerações).
  - Teste de reprovação na 1ª tentativa e aprovação na 2ª com injeção de feedback no prompt.
  - Teste de alcance do limite `maxReflections` retornando a melhor resposta com registro no trace.
  - Teste de cálculo acumulado de métricas e rastreabilidade cronológica do trace.

### Phase 3 - Integração com a Arena CLI
- Atualizar `src/arena.ts`:
  - Mapear `reflect:react`, `reflec:react`, `reflect:plan-and-execute`, `reflec:plan-and-execute`.
- Validação end-to-end com `npm run typecheck`, `npm run test` e execução na arena.

├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
