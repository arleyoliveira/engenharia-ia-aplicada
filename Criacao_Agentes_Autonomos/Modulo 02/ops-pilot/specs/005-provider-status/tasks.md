---

description: "Task list for check_provider_status external provider tool"
---

# Tasks: Status de provedores externos

**Input**: Design documents from `/specs/005-provider-status/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution in `.specify/memory/constitution.md`

**Tests**: A feature exige testes determinísticos com fake fetch (FR-010/FR-011, US3): sucesso, timeout, payload inválido e retry 5xx/rede, sem acesso à internet.

**Organization**: Tarefas agrupadas por história de usuário para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: História à qual a tarefa pertence (US1, US2, US3)
- Incluir caminhos de arquivo exatos em cada descrição

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o módulo de serviço e o ponto de registro da tool sem alterar o comportamento das tools existentes.

- [X] T001 Criar o esqueleto de `src/services/provider-status.ts` com exports planejados (`ProviderId`, `checkProviderStatus`) e mapa constante vazio de URLs Statuspage
- [X] T002 [P] Criar o arquivo de testes `src/services/provider-status.test.ts` com `describe`/`it` (`node:test`) prontos para fake fetch, sem chamadas de rede
- [X] T003 [P] Confirmar o ponto de integração em `src/agents/tools.ts` (`createOpsTools` / `createDefaultOpsTools`) onde `check_provider_status` entrará no array retornado

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contratos de domínio, validação Zod e injeção de fetch que bloqueiam todas as histórias.

**⚠️ CRITICAL**: Nenhuma história pode começar antes desta fase estar completa

- [X] T004 Definir tipos e mapa de provedores em `src/services/provider-status.ts`: `ProviderId` (`github` | `cloudflare`), URLs fixas (`githubstatus.com` / `cloudflarestatus.com` `/api/v2/status.json`) e tipo interno `ProviderStatusResult`
- [X] T005 [P] Implementar schema Zod mínimo do payload Statuspage em `src/services/provider-status.ts` (`status.indicator` e `status.description` como `z.string().min(1)`), ignorando demais campos
- [X] T006 Implementar a assinatura `checkProviderStatus({ provider, fetchImpl? })` em `src/services/provider-status.ts` com `fetchImpl` tipado como `typeof fetch` e default `globalThis.fetch`
- [X] T007 [P] Estender `createOpsTools` em `src/agents/tools.ts` para aceitar deps opcionais `{ fetchImpl?: typeof fetch }` (ou equivalente) propagáveis aos testes, sem quebrar a assinatura atual usada por `createDefaultOpsTools`, react e plan-and-execute

**Checkpoint**: Foundation pronta — tipos, Zod, mapa de URLs e injeção de fetch disponíveis; histórias podem começar

---

## Phase 3: User Story 1 - Distinguir falha interna de provedor externo (Priority: P1) 🎯 MVP

**Goal**: O plantonista (via agente) consulta GitHub/Cloudflare e recebe uma linha compacta `provider: indicator — description` para decidir se o incidente é interno ou do provedor.

**Independent Test**: Com fake fetch devolvendo status operacional do GitHub, invocar com `provider` omitido (default) e confirmar uma linha compacta; repetir com `cloudflare`.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US1] Escrever teste de sucesso GitHub (default) em `src/services/provider-status.test.ts` com fake fetch de payload válido e assert da linha `github: {indicator} — {description}`
- [X] T009 [P] [US1] Escrever teste de sucesso Cloudflare em `src/services/provider-status.test.ts` com fake fetch e assert da linha `cloudflare: … — …`
- [X] T010 [P] [US1] Escrever smoke em `src/agents/tools.test.ts` garantindo que `check_provider_status` está no conjunto de tools, schema enum `github|cloudflare` com default `github`, e descrição cobre quando usar / quando não usar

### Implementation for User Story 1

- [X] T011 [US1] Implementar o caminho feliz de `checkProviderStatus` em `src/services/provider-status.ts`: GET na URL do provedor, parse JSON, validação Zod e resumo compacto `{provider}: {indicator} — {description}`
- [X] T012 [US1] Registrar a tool `check_provider_status` em `src/agents/tools.ts` com schema Zod (`provider` enum + `.default("github")` + `.describe()`), descrição orientada a suspeita externa / “é nosso ou do provedor?” / dependência fora do ar, e retorno sempre `string`
- [X] T013 [US1] Incluir `check_provider_status` no array retornado por `createOpsTools` em `src/agents/tools.ts` e atualizar a expectativa de nomes em `src/agents/tools.test.ts` (de 5 para 6 tools)
- [X] T014 [US1] Garantir que `createDefaultOpsTools` em `src/agents/tools.ts` continua compondo o store padrão e expõe a nova tool sem configuração extra

**Checkpoint**: US1 funcional — sucesso com fake fetch devolve linha compacta; tool registrada no conjunto do agente

---

## Phase 4: User Story 2 - Falha de consulta não quebra o raciocínio (Priority: P2)

**Goal**: Timeout, 5xx/rede (com uma retentativa) e payload inválido viram string de erro legível; a tool nunca lança exceção para fora.

**Independent Test**: Com fetch fake de timeout, 5xx (1 retry) e JSON inválido, confirmar retorno de string legível e ausência de exceção escapando da tool.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US2] Escrever teste de timeout em `src/services/provider-status.test.ts` com fake fetch que aborta/simula timeout e assert de string de erro legível (sem throw)
- [X] T016 [P] [US2] Escrever teste de retry único em `src/services/provider-status.test.ts`: primeira chamada 5xx ou falha de rede → exatamente uma segunda tentativa; falha final → erro legível; sucesso na 2ª → linha compacta
- [X] T017 [P] [US2] Escrever testes de payload inválido e HTTP 4xx em `src/services/provider-status.test.ts` (JSON malformado, campos ausentes, 4xx) confirmando erro legível **sem** retry
- [X] T018 [P] [US2] Escrever teste na tool em `src/agents/tools.test.ts` com `fetchImpl` injetado falhando, confirmando que o handler devolve string e não propaga exceção

### Implementation for User Story 2

- [X] T019 [US2] Implementar timeout de 5s via `AbortSignal.timeout(5000)` por tentativa em `src/services/provider-status.ts`
- [X] T020 [US2] Implementar política de resiliência em `src/services/provider-status.ts`: exatamente um retry somente para rede/timeout/HTTP 5xx; sem retry para 4xx nem para falha Zod/JSON após 200
- [X] T021 [US2] Converter todas as falhas finais em `ProviderStatusResult` de erro (`ok: false`) com mensagem legível prefixada (ex.: `check_provider_status failed: …`) em `src/services/provider-status.ts`
- [X] T022 [US2] Envolver o handler da tool em `src/agents/tools.ts` com `try/catch` que sempre `return` string (sucesso compacto ou erro legível), nunca rethrow — alinhado a FR-009

**Checkpoint**: US2 funcional — falhas viram observação; retry único só em rede/5xx/timeout

---

## Phase 5: User Story 3 - Testes determinísticos sem rede (Priority: P3)

**Goal**: A suíte valida sucesso, timeout e inválido com fake fetch injetável, sem nenhuma chamada às status pages reais.

**Independent Test**: Rodar `npm run test -- src/services/provider-status.test.ts` e `npm run test -- src/agents/tools.test.ts`; cobrir sucesso/timeout/inválido e zero rede real.

### Tests for User Story 3

- [X] T023 [P] [US3] Consolidar em `src/services/provider-status.test.ts` asserts de contagem de chamadas ao fake fetch (1 em sucesso/4xx/inválido; 2 em 5xx/rede/timeout elegível a retry)
- [X] T024 [P] [US3] Garantir em `src/services/provider-status.test.ts` e `src/agents/tools.test.ts` que os fakes não usam `globalThis.fetch` real e não apontam para URLs Statuspage em assert de rede
- [X] T025 [P] [US3] Validar rejeição de `provider` inválido na fronteira Zod da tool em `src/agents/tools.test.ts` sem invocar fetch

### Implementation for User Story 3

- [X] T026 [US3] Revisar a API pública de `checkProviderStatus` em `src/services/provider-status.ts` para manter `fetchImpl` obrigatoriamente injetável nos testes e default apenas em produção
- [X] T027 [US3] Ajustar helpers de teste em `src/agents/tools.test.ts` (`makeMemoryTools` ou equivalente) para aceitar `fetchImpl` fake ao montar `createOpsTools`
- [X] T028 [US3] Confirmar que a descrição de `check_provider_status` em `src/agents/tools.ts` passa na suíte das 6 regras já existente em `src/agents/tools.test.ts`

**Checkpoint**: US3 completa — regressão determinística sem rede, auditável pela descrição da tool

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final alinhada ao quickstart e à constituição.

- [X] T029 [P] Revisar aderência a `.specify/memory/constitution.md` (camadas serviço/tool, Zod na fronteira, erro como observação, testes obrigatórios, sem segredos/env para URLs)
- [X] T030 [P] Validar os cenários de `specs/005-provider-status/quickstart.md` (testes do serviço + tools + typecheck)
- [X] T031 Executar `npm run typecheck` e `npm run test` e garantir suite green, incluindo regressão das tools existentes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente
- **Foundational (Phase 2)**: depende de Setup — bloqueia todas as histórias
- **User Story 1 (Phase 3)**: depende da Phase 2 — entrega o MVP (consulta + linha compacta)
- **User Story 2 (Phase 4)**: depende da Phase 2; idealmente após o caminho feliz de US1 no mesmo módulo de serviço
- **User Story 3 (Phase 5)**: depende da Phase 2; consolida e endurece a suíte das US1/US2
- **Polish (Final Phase)**: depende de todas as histórias desejadas concluídas

### User Story Dependencies

- **US1 (P1)**: só depende da Phase 2 — valor central da feature
- **US2 (P2)**: depende da Phase 2; estende o mesmo serviço/tool da US1 com resiliência
- **US3 (P3)**: depende da Phase 2; pode ser escrita em paralelo aos testes das US1/US2, mas fecha a cobertura determinística

### Within Each User Story

- Testes FIRST (falhando) antes da implementação correspondente
- Tipos/Zod (Phase 2) antes do fetch
- Serviço antes do registro da tool
- Caminho feliz (US1) antes da política completa de retry (US2), no mesmo arquivo de serviço

### Parallel Opportunities

- `T002` e `T003` em paralelo na Phase 1
- `T005` e `T007` em paralelo na Phase 2 (após/com `T004`/`T006` conforme dependência de tipos)
- `T008`, `T009` e `T010` em paralelo na US1
- `T015`, `T016`, `T017` e `T018` em paralelo na US2
- `T023`, `T024` e `T025` em paralelo na US3
- `T029` e `T030` em paralelo na Phase 6

---

## Parallel Example: User Story 1

```bash
# Lançar testes da US1 em paralelo:
Task: "Escrever teste de sucesso GitHub em src/services/provider-status.test.ts"
Task: "Escrever teste de sucesso Cloudflare em src/services/provider-status.test.ts"
Task: "Escrever smoke da tool em src/agents/tools.test.ts"
```

## Parallel Example: User Story 2

```bash
# Lançar testes de resiliência em paralelo:
Task: "Teste de timeout em src/services/provider-status.test.ts"
Task: "Teste de retry 5xx/rede em src/services/provider-status.test.ts"
Task: "Teste de payload inválido/4xx em src/services/provider-status.test.ts"
Task: "Teste de erro na tool em src/agents/tools.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational
3. Completar Phase 3: US1 (consulta + linha compacta + registro da tool)
4. **STOP and VALIDATE**: fake fetch GitHub default + Cloudflare; tool no conjunto
5. Entrega mínima demonstrável: agente distingue “nosso vs provedor” no caminho feliz

### Incremental Delivery

1. Setup + Foundational → tipos, Zod, fetch injetável
2. US1 → sucesso compacto e tool registrada (MVP)
3. US2 → timeout, retry único, erro como observação
4. US3 → suíte determinística consolidada sem rede
5. Polish → typecheck/test green e quickstart validado

### Parallel Team Strategy

1. Time completa Setup + Foundational junto
2. Após Phase 2:
   - Dev A: US1 (caminho feliz serviço + tool)
   - Dev B: US2 (resiliência e erros legíveis)
   - Dev C: US3 (hardening dos testes / helpers de injeção)
3. Polish valida a entrega em conjunto

---

## Notes

- [P] = arquivos diferentes, sem dependências incompletas
- [USn] mapeia a tarefa para a história correspondente
- Cada história deve ser implementável e testável de forma independente
- Testes devem falhar antes da implementação nas fases de US
- Caminho canônico: `src/agents/tools.ts` (plural), não `src/agent/`
- Sem variáveis de ambiente para URLs; sem chave de API; sem persistência
- Evitar: lógica de rede inline só na tool; throw escapando do handler; retry em 4xx/Zod fail
