# Tasks: Camada de Reflection para Estratégias de Raciocínio

**Input**: Design documents from `specs/002-reflection-layer/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/reflection-api.md](contracts/reflection-api.md), [contracts/cli.md](contracts/cli.md)
**Constitution**: Testes determinísticos são obrigatórios (Princípio IV: Non-Negotiable), funções puras, sem leitura de `.env`, tipagem estrita TypeScript ESM.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Tarefas que podem rodar em paralelo (arquivos distintos, sem dependências incompletas)
- **[Story]**: Identificador da história de usuário ([US1], [US2], [US3]) mapeado para a spec
- Toda tarefa inclui caminhos de arquivos exatos e descrições acionáveis

---

## Phase 1: Setup & Types

**Purpose**: Estruturas de tipos e schemas fundamentais para a camada de reflexão

- [X] T001 Exportar tipos `ReflectionOptions` e `CritiqueResult` em [src/agents/types.ts](src/agents/types.ts)
- [X] T002 Definir `critiqueSchema` com validação Zod para `{ approved, feedback }` em [src/agents/reflection.ts](src/agents/reflection.ts)

---

## Phase 2: Foundational (Extração de Observações e Resiliência)

**Purpose**: Componentes utilitários puros consumidos pelo decorador de reflexão

- [X] T003 Implementar função pura `extractObservations(trace: TraceEvent[]): string[]` em [src/agents/reflection.ts](src/agents/reflection.ts)
- [X] T004 Implementar invocação estruturada do crítico com retry e mapeamento para `ModelOutputError` em [src/agents/reflection.ts](src/agents/reflection.ts)

**Checkpoint**: Base de tipos, schema Zod e parsing de observações prontos para implementação das histórias.

---

## Phase 3: User Story 1 - Validação Crítica e Auto-Correção de Respostas (Priority: P1) 🎯 MVP

**Goal**: Implementar a função decoradora `withReflection(strategy, options)` que executa a base, avalia com o crítico contra observações, registra o evento `critique` no trace, reinvoca a base com feedback quando reprovado e para em aprovação ou `maxReflections` (default 2), agregando métricas e tempo total.

**Independent Test**: Executar `src/agents/reflection.test.ts` sem rede, validando: aprovação de 1ª rodada (1 crítica, sem regeneração), reprovação com injeção de feedback que gera resposta corrigida na 2ª rodada e parada no limite `maxReflections`.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Criar suite de testes unitários determinísticos com fakes de estratégia e modelo em [src/agents/reflection.test.ts](src/agents/reflection.test.ts)
- [X] T006 [P] [US1] Adicionar casos de teste para aprovação direta de 1ª rodada em [src/agents/reflection.test.ts](src/agents/reflection.test.ts)
- [X] T007 [P] [US1] Adicionar casos de teste para reprovação e reexecução com injeção de feedback corretivo no contexto em [src/agents/reflection.test.ts](src/agents/reflection.test.ts)
- [X] T008 [P] [US1] Adicionar casos de teste para parada no limite `maxReflections` com registro do limite no trace em [src/agents/reflection.test.ts](src/agents/reflection.test.ts)

### Implementation for User Story 1

- [X] T009 [US1] Implementar a função decoradora `withReflection` com loop de crítica/regeneração em [src/agents/reflection.ts](src/agents/reflection.ts)
- [X] T010 [US1] Implementar agregação acumulada de métricas (`llmCalls` das execuções base + chamadas do crítico, `latencyMs` total) em [src/agents/reflection.ts](src/agents/reflection.ts)
- [X] T011 [US1] Exportar `withReflection` e instâncias refletidas padrão em [src/agents/reflection.ts](src/agents/reflection.ts) e [src/agents/index.ts](src/agents/index.ts) ou export direto

**Checkpoint**: User Story 1 (MVP) completamente implementada e validada via `npm run test`.

---

## Phase 4: User Story 2 - Comparação de Estratégias na Arena CLI (Priority: P2)

**Goal**: Expor as estratégias decoradas com reflexão na CLI da arena (`reflect:react`, `reflect:plan-and-execute` e aliases tolerantes `reflec:*`), permitindo executar e comparar lado a lado as respostas, traces completos e métricas.

**Independent Test**: Invocar `src/arena.ts` via terminal com `--strategies react,reflect:react` ou `--strategies plan-and-execute,reflect:plan-and-execute` e confirmar exibição dos blocos formatados com eventos `[critique]` e métricas consolidadas.

### Implementation for User Story 2

- [X] T012 [US2] Importar `withReflection` e registrar estratégias `reflect:react`, `reflec:react`, `reflect:plan-and-execute`, `reflec:plan-and-execute` no mapa `STRATEGIES` em [src/arena.ts](src/arena.ts)
- [X] T013 [US2] Validar suporte da CLI para execução simultânea de estratégias base e refletidas em [src/arena.ts](src/arena.ts)

**Checkpoint**: Estratégias refletidas acessíveis e executáveis via CLI da arena.

---

## Phase 5: User Story 3 - Rastreabilidade e Auditoria dos Julgamentos (Priority: P3)

**Goal**: Garantir que todos os vereditos do crítico (`[APROVADO]`, `[REPROVADO]`, `[LIMITE ATINGIDO]`) sejam emitidos como eventos tipados `critique` no trace na ordem cronológica correta e formatados estavelmente por `formatTrace`.

**Independent Test**: Testar em `src/agents/trace.test.ts` e `src/agents/reflection.test.ts` a formatação de múltiplos eventos `critique` intercalados com ações e observações.

### Implementation for User Story 3

- [X] T014 [US3] Validar e padronizar o conteúdo textual de eventos `critique` (`[APROVADO] {feedback}`, `[REPROVADO] {feedback}`) em [src/agents/reflection.ts](src/agents/reflection.ts)
- [X] T015 [P] [US3] Adicionar teste unitário de formatação de trace com eventos de reflexão em [src/agents/trace.test.ts](src/agents/trace.test.ts)

**Checkpoint**: Rastreabilidade e serialização determinística completas para auditoria.

---

## Phase 6: Polish & Validation

**Purpose**: Validação de ponta a ponta e garantia de qualidade da base de código

- [X] T016 [P] Executar verificação de tipos completa (`npm run typecheck`) garantindo zero erros TypeScript
- [X] T017 [P] Executar suite completa de testes (`npm run test`) garantindo que todos os testes passem
- [X] T018 Executar validação manual dos cenários do [quickstart.md](quickstart.md) na arena

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — inicia imediatamente
- **Foundational (Phase 2)**: Depende de Phase 1 — bloqueia implementação do User Story 1
- **User Story 1 (Phase 3 - MVP)**: Depende de Phase 2
- **User Story 2 (Phase 4)**: Depende da conclusão do decorador em User Story 1
- **User Story 3 (Phase 5)**: Pode ser finalizada em conjunto ou após User Story 1
- **Polish (Phase 6)**: Depende de todas as fases anteriores

### User Story Dependencies

- **US1 (P1)**: Independente de US2/US3 — entrega o decorador funcional com reflexão e auto-correção
- **US2 (P2)**: Depende de US1 (consome `withReflection(strategy)` na arena)
- **US3 (P3)**: Depende de US1 (padroniza os eventos `critique` gerados por US1)

### Parallel Opportunities

- **T005, T006, T007, T008**: Casos de teste em `reflection.test.ts` podem ser estruturados em paralelo
- **T015, T016, T017**: Testes de trace, typecheck e test run geral podem rodar de forma isolada

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir Phase 1 e Phase 2 (Setup e Funções Fundamentais).
2. Escrever os testes em `src/agents/reflection.test.ts` (T005-T008).
3. Implementar `withReflection` em `src/agents/reflection.ts` até os testes passarem (T009-T011).
4. **Validar MVP**: `npm run test` verde.

### Entrega Incremental

1. MVP concluído → Decorador funcional testado isoladamente.
2. Integrar na CLI da Arena (US2: T012-T013) → Habilita comparação `npm run arena -- --strategies react,reflect:react`.
3. Validar rastreabilidade estrita de traces (US3: T014-T015).
4. Polish final (T016-T018) com `npm run typecheck` e `npm run test`.
