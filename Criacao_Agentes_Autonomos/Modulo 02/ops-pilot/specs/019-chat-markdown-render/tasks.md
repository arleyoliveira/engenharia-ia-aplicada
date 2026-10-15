---
description: "Task list for chat markdown render in war room"
---

# Tasks: Respostas em Markdown na war room

**Input**: Design documents from `/specs/019-chat-markdown-render/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: A spec exige suíte sem rede (FR-010): cabeçalho e lista visíveis; prosa simples; mensagem do usuário sem Markdown; script/HTML inerte; link https seguro; regressão da war room. Ver [contracts/answer-markdown-ui.md](contracts/answer-markdown-ui.md) e [quickstart.md](quickstart.md).

**Organization**: Por história. Contratos: [contracts/answer-markdown-ui.md](contracts/answer-markdown-ui.md), [contracts/chat-http.md](contracts/chat-http.md) (sem mudança HTTP).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3 / US4
- Incluir caminhos de arquivo exatos

## Path Conventions

- Cliente: `web/src/`
- Modelo puro: `web/src/model/answer-markdown.ts`
- UI: `web/src/ui/AnswerBody.tsx`, `web/src/ui/WarRoom.tsx`
- Estilos: `web/src/styles.css`
- API `src/`: **fora de escopo** (FR-009)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependências Markdown no pacote `web/`.

- [X] T001 Acrescentar `react-markdown`, `remark-gfm` e `rehype-sanitize` em `web/package.json` e rodar `npm install --prefix web` até o lockfile atualizar ([research.md](research.md) R1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Funções puras de cabeçalho e URL usadas por `AnswerBody`. Bloqueia US1–US4.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase

- [X] T002 Em `web/src/model/answer-markdown.test.ts` (Vitest): `isSafeHref` aceita só `http:` e `https:`; rejeita `javascript:`, vazio e esquemas desconhecidos. `markdownHeadingTag` mapeia `#` → `h2`, `##` → `h3`, `###` → `h4`, `####` e mais → `h4` ([research.md](research.md) R3)
- [X] T003 Em `web/src/model/answer-markdown.ts`, exportar `isSafeHref` e `markdownHeadingTag` (e helpers mínimos que os testes exigirem) até T002 passar. Sem import de React

**Checkpoint**: Regras de heading e link testáveis sem DOM

---

## Phase 3: User Story 1 - Resposta estruturada (Priority: P1) 🎯 MVP

**Goal**: O balão do assistente mostra `answer` com títulos, listas, ênfase e código formatados; `requestId` e "ver raciocínio" permanecem abaixo.

**Independent Test**: `npm test --prefix web -- AnswerBody WarRoom` com `fetch` fake devolvendo `200` e `answer` com `## Status`, lista, `` `inline` `` e bloco cercado.

### Tests for User Story 1

> Escrever primeiro; devem falhar até `AnswerBody` e o wiring em `WarRoom` existirem.

- [X] T004 [US1] Em `web/src/ui/AnswerBody.test.tsx`: montar `AnswerBody` com `answer` contendo `## Status`, `- item a`, `- item b`, `` `list_alerts` `` e bloco cercado de várias linhas. Esperar `h2`, dois `li`, `code` inline e `pre` > `code`; o texto visível não deve ser dominado pelos literais `## Status` nem `- item a` como único parágrafo ([contracts/answer-markdown-ui.md](contracts/answer-markdown-ui.md))
- [X] T005 [P] [US1] Em `web/src/ui/WarRoom.test.tsx`: `200` fake com `answer` Markdown; após envio, o fio contém estrutura formatada no balão do assistente. Abrir e fechar "ver raciocínio" não remove o corpo formatado nem dispara novo `POST`

### Implementation for User Story 1

- [X] T006 [US1] Criar `web/src/ui/AnswerBody.tsx`: `ReactMarkdown` com `remarkGfm`, `rehypeSanitize`, wrapper `className="answer-md"`, componentes custom para `code`/`pre` e cabeçalhos via `markdownHeadingTag` (detalhe fino de headings pode completar em US4). Exportar `AnswerBody({ answer }: { answer: string })`
- [X] T007 [US1] Em `web/src/styles.css`, estilos `.answer-md` para `p`, `ul`, `ol`, `h2`–`h4`, `code`, `pre`, `strong`, `em` usando tokens `--text`, `--text-muted`, `--accent`, `--border`, `--surface-raised` e escala 4–48 ([.cursor/rules/design.mdc](../../../.cursor/rules/design.mdc))
- [X] T008 [US1] Em `web/src/ui/WarRoom.tsx`, substituir `<p>{turn.answer}</p>` por `<AnswerBody answer={turn.answer} />` dentro do `<article class="bubble">`; manter `.meta` e `TracePanel` inalterados

**Checkpoint**: US1 — Markdown legível no balão; trace e metadado intactos

---

## Phase 4: User Story 2 - Prosa e mensagem do plantonista (Priority: P1)

**Goal**: Respostas sem Markdown continuam legíveis; balão do usuário não interpreta Markdown.

**Independent Test**: Vitest em `AnswerBody` e `WarRoom` com prosa simples e `**urgente**` na mensagem do plantonista.

### Tests for User Story 2

- [X] T009 [P] [US2] Em `web/src/ui/AnswerBody.test.tsx`: `answer: "Nenhum alerta firing."` renderiza o texto integral, sem mensagem de erro de formato
- [X] T010 [US2] Em `web/src/ui/WarRoom.test.tsx`: plantonista envia `**urgente**`; o balão `user` ainda mostra os asteriscos literais (sem `<strong>`)

### Implementation for User Story 2

- [X] T011 [US2] Confirmar que só turnos `kind: "answer"` usam `AnswerBody` em `web/src/ui/WarRoom.tsx`; cartão `202`, erro e compositor permanecem texto plano (FR-005, FR-006). Ajustar `AnswerBody` se prosa vazia/só espaços precisar do comportamento já existente da sala

**Checkpoint**: US2 — compatibilidade com respostas curtas e mensagens do usuário

---

## Phase 5: User Story 3 - Sanitização e links (Priority: P1)

**Goal**: Sem script/HTML ativo na `answer`; links `https` abrem em nova aba com `rel` seguro; código e links legíveis nos temas.

**Independent Test**: `npm test --prefix web -- AnswerBody` com payloads maliciosos e link `https://example.com`.

### Tests for User Story 3

- [X] T012 [P] [US3] Em `web/src/ui/AnswerBody.test.tsx`: `answer` com `<script>alert(1)</script>` e `[x](javascript:alert(1))` — o container `.answer-md` não contém `script`; link `javascript:` não produz `<a href="javascript:...">` navegável
- [X] T013 [P] [US3] Em `web/src/ui/AnswerBody.test.tsx`: `[status](https://example.com)` gera `<a href="https://example.com">` com `target="_blank"` e `rel` contendo `noopener` e `noreferrer`
- [X] T014 [P] [US3] Em `web/src/ui/AnswerBody.test.tsx`: `![alt](https://example.com/x.png)` não renderiza `<img src="https://...">` remoto; alt ou omissão estável conforme [research.md](research.md) R4

### Implementation for User Story 3

- [X] T015 [US3] Em `web/src/ui/AnswerBody.tsx`, componente `a` usando `isSafeHref`; inseguro vira `<span>`. Seguro: `target="_blank"`, `rel="noopener noreferrer"`. Componente `img` sem fetch remoto. Manter `rehypeSanitize` na pipeline
- [X] T016 [US3] Em `web/src/styles.css`, reforçar contraste de `.answer-md a`, `.answer-md code` e `.answer-md pre` nos temas claro e escuro (tokens existentes; sem hex solto)

**Checkpoint**: US3 — FR-003 e FR-004 cobertos por testes

---

## Phase 6: User Story 4 - Semântica acessível (Priority: P2)

**Goal**: Cabeçalhos dentro do balão não competem com o `h1` da sala; listas semânticas; foco visível em links.

**Independent Test**: Resposta com `### Detalhe` e listas; inspecionar um único `h1` na página (`War room`).

### Tests for User Story 4

- [X] T017 [P] [US4] Em `web/src/ui/AnswerBody.test.tsx`: `### Seção` renderiza cabeçalho mapeado (`h4` per research), não `h1`. Montar `WarRoom` + resposta fake: documento tem um só `h1`
- [X] T018 [P] [US4] Em `web/src/ui/AnswerBody.test.tsx`: listas ordenada e não ordenada usam `ol`/`ul` com `li`, não apenas sequência de `<br>`

### Implementation for User Story 4

- [X] T019 [US4] Em `web/src/ui/AnswerBody.tsx`, garantir mapeamento de headings via `markdownHeadingTag` para todos os níveis `#`–`###` (FR-008)
- [X] T020 [US4] Em `web/src/styles.css`, adicionar `.answer-md a:focus-visible` alinhado ao foco dos demais controles da sala

**Checkpoint**: US4 — hierarquia e listas para leitores de tela

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Regressão da war room e gate da raiz.

- [X] T021 Rodar `npm test --prefix web -- src/ui/WarRoom.test.tsx` e corrigir regressões em cartão `202`, engrenagem, retry e envio (SC-006)
- [X] T022 Executar [quickstart.md](quickstart.md): `npm run typecheck` e `npm run test` na raiz com exit 0

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — começar por T001
- **Foundational (Phase 2)**: Depende de T001 — **bloqueia** US1–US4
- **US1 (Phase 3)**: Depende de Phase 2; entrega MVP visual
- **US2 (Phase 4)**: Depende de T008 (wiring); testes T009–T010 podem ser escritos em paralelo com US3 após T006
- **US3 (Phase 5)**: Depende de T006 (AnswerBody base); T012–T014 antes de T015
- **US4 (Phase 6)**: Depende de T006; pode sobrepor US3 após AnswerBody inicial
- **Polish (Phase 7)**: Depois de US1–US4 desejadas

### User Story Dependencies

| História | Depende de | Independente quando |
| --- | --- | --- |
| US1 | T003 | T004–T008 verdes |
| US2 | T008 | T009–T011 verdes |
| US3 | T006 | T012–T016 verdes |
| US4 | T006 | T017–T020 verdes |

US3 e US4 podem ser desenvolvidas em paralelo após T006, em arquivos distintos (`AnswerBody.tsx` vs `styles.css`), coordenando merges no mesmo componente.

### Parallel Opportunities

- T005 ∥ T004 (após T003, arquivos distintos)
- T009 ∥ T012 ∥ T013 ∥ T014 (testes US2/US3, após T006)
- T017 ∥ T018 (US4 testes)
- T015 e T019: sequenciar ou combinar numa única edição de `AnswerBody.tsx`

---

## Parallel Example: User Story 3

```bash
# Testes de segurança primeiro (mesmo arquivo, sequenciais ou um describe):
npm test --prefix web -- src/ui/AnswerBody.test.tsx

# Depois implementação:
# web/src/ui/AnswerBody.tsx
# web/src/styles.css
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 e Phase 2
2. Phase 3 (T004–T008)
3. Parar e validar: `npm test --prefix web -- AnswerBody WarRoom`

### Incremental Delivery

1. US1 — valor principal (Markdown no balão)
2. US2 — prosa e mensagem do usuário
3. US3 — sanitização e links (obrigatório antes de produção)
4. US4 — refinamento a11y (P2)
5. T021–T022 — gate completo

### Parallel Team Strategy

1. Uma pessoa: T001–T003
2. Dev A: US1 (T004–T008)
3. Dev B (após T006): US3 testes T012–T014 enquanto A termina WarRoom
4. US4 e Polish na sequência ou em paralelo com US2

---

## Notes

- Testes são obrigatórios (FR-010 e constituição IV): falhar primeiro, depois implementar
- Não alterar `src/http/server.ts`, schemas Zod do chat nem formato da `answer` na API
- Trace (`TracePanel`), cartão `202` e `requestId` permanecem texto plano
- Política de imagem: sem `<img>` remoto — documentar escolha (alt como texto ou omitir) no teste T014
- Próximo comando após concluir tarefas: `/speckit-implement`
