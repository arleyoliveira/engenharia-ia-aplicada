---

description: "Task list for the OpsPilot war room web"
---

# Tasks: War room web

**Input**: Design documents from `/specs/016-war-room-web/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: A spec pede suíte sem modelo e sem rede (FR-013): fio com `conversationId`, trace tipado, cartão do `202`, engrenagem, CORS e corpo `decision`. Ver [contracts/chat-http.md](contracts/chat-http.md), [contracts/war-room-ui.md](contracts/war-room-ui.md) e [quickstart.md](quickstart.md).

**Organization**: Por história. US1, US2 e US3 são P1. US4, US5 e US6 são P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3 / US4 / US5 / US6
- Incluir caminhos de arquivo exatos

## Path Conventions

- API: `src/` na raiz, testes `src/**/*.test.ts` (`node:test` + `tsx`)
- Sala: pacote `web/`, testes Vitest + jsdom ao lado do código (`web/src/**/*.test.ts` e `web/src/**/*.test.tsx`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pacote `web/` com Vite, React e TypeScript, e o gate da raiz passando a incluir esse pacote. Sem CORS e sem decisão ainda.

- [X] T001 [P] Criar `web/package.json` com `react` e `react-dom`; devDependencies `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@types/react` e `@types/react-dom`. Scripts: `dev` = `vite`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`
- [X] T002 [P] Criar `web/tsconfig.json` com `strict`, `jsx` `react-jsx`, `module` `ESNext`, `moduleResolution` `bundler`, `noEmit`, `types` incluindo `vite/client`, `include` `src`
- [X] T003 [P] Criar `web/vite.config.ts` com o plugin React, `base: "/opspilot/"`, `server.port` `5173` e `test.environment` `jsdom` ([research.md](research.md) R1)
- [X] T004 [P] Criar `web/index.html` (elemento `#root` e script `src/main.tsx`), `web/src/main.tsx` e `web/src/ui/WarRoom.tsx` renderizando um único `h1` com o texto `War room`. `main.tsx` importa `web/src/styles.css` (arquivo vazio nesta tarefa)
- [X] T005 Em `package.json` da raiz, encadear `npm run typecheck --prefix web` no script `typecheck` e `npm test --prefix web` no script `test`, depois do `node:test` já existente

**Checkpoint**: `npm run typecheck --prefix web` sobe o `tsc` da sala. A página ainda não conversa

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tokens visuais e o cliente HTTP que toda história da sala usa. Bloqueia US1–US4 e US6.

**⚠️ CRITICAL**: Nenhuma história da sala começa antes desta fase. US5 (CORS no Express) não usa estes arquivos e pode seguir depois do Setup

- [X] T006 Criar `web/src/styles.css` com a escala `--space-4` `4px`, `--space-8` `8px`, `--space-12` `12px`, `--space-16` `16px`, `--space-24` `24px`, `--space-32` `32px`, `--space-48` `48px` e os tokens `--surface`, `--text`, `--text-muted`, `--border`, `--accent`, `--danger`. Valores claros em `:root`. Escuros em `[data-theme="dark"]` e, quando `data-theme` estiver ausente, em `@media (prefers-color-scheme: dark)`. Sem `#000` nem `#fff`. `:focus-visible` usa `--accent`. Componentes futuros só consomem essas variáveis (`.github/instructions/design.instructions.md`)
- [X] T007 [P] Em `web/src/api/chat.test.ts` (Vitest): `joinChatUrl("http://localhost:3000")` e `joinChatUrl("http://localhost:3000/")` devolvem `http://localhost:3000/chat`. `joinChatUrl("http://localhost:3000/prefix/")` devolve `http://localhost:3000/prefix/chat`. `postChat` com `fetch` fake: status `200` vira resposta com `answer`, `trace`, `requestId` e `conversationId`; status `202` vira pendência com `pendingAction` e `trace` (ausente vale `[]`); status `400`, `404`, `422`, `500`, `503` e `504` viram erro com o status; `fetch` que rejeita vira erro de alcance, sem status
- [X] T008 Implementar `joinChatUrl` e `postChat` em `web/src/api/chat.ts` conforme T007. `postChat` envia `Content-Type: application/json` e o corpo recebido, sem acrescentar campo. JSON ilegível no `200` ou `202` vira erro de alcance ([research.md](research.md) R6–R7)

**Checkpoint**: URL do chat e classificação de status testáveis. A sala ainda é só o título

---

## Phase 3: User Story 1 - Conversar na war room (Priority: P1) 🎯 MVP

**Goal**: O plantonista vê a sala vazia, envia uma mensagem para `POST {api}/chat` e lê a `answer` no fio. O turno seguinte reenvia o `conversationId`. Espera, vazio e erro são distintos.

**Independent Test**: `npm test --prefix web -- src/model/thread.test.ts src/ui/WarRoom.test.tsx` sem rede. `fetch` fake. O segundo envio leva o `conversationId` do `200`. Mensagem em branco não chama `fetch`.

### Tests for User Story 1

> Escrever primeiro; devem falhar até o fio existir.

- [X] T009 [P] [US1] Em `web/src/model/thread.test.ts`: estado inicial sem turnos e sem `conversationId`. Enfileirar uma mensagem não vazia acrescenta o texto do plantonista e marca envio em voo. Aplicar um `200` acrescenta `answer`, `requestId` e `trace`, guarda `conversationId` e libera o envio. Um segundo envio usa esse `conversationId`. Mensagem só com espaços não muda o fio. Erro de rede ou status `400`/`404`/`422`/`500`/`503`/`504` acrescenta um erro com o corpo a reenviar e não apaga turnos anteriores. `retry` desse erro volta a marcar envio em voo com o mesmo corpo ([data-model.md](data-model.md))
- [X] T010 [US1] Em `web/src/ui/WarRoom.test.tsx`: antes do envio, o texto `Nenhuma mensagem ainda` está visível e há um único heading `War room`. Enviar `status do billing` com `fetch` fake `200` (`answer`, `requestId`, `conversationId`, `trace: []`) mostra a answer e o `requestId`. O segundo envio vai para `http://localhost:3000/chat` com `{ message, conversationId }` do primeiro `200`. Texto só com espaços não chama `fetch` e o aviso fica no campo. Com a promessa do `fetch` pendente, outro submit não dispara segundo `fetch`. Uma rejeição de `fetch` mostra que a API não foi alcançada e `Tentar de novo` reenvia o mesmo corpo; o texto já exibido permanece

### Implementation for User Story 1

- [X] T011 [US1] Implementar o redutor do fio em `web/src/model/thread.ts` cobrindo T009. Base padrão da sala, enquanto a engrenagem não existe: `http://localhost:3000`
- [X] T012 [US1] Em `web/src/ui/WarRoom.tsx`, compositor com rótulo visível, estado vazio, bolha da answer, metadado `requestId`, espera distinta do vazio e do erro, e `Tentar de novo`. Chamar `postChat` de `web/src/api/chat.ts`. Espaçamento só com as variáveis de `web/src/styles.css`. Não implementar trace, cartão nem engrenagem nesta tarefa

**Checkpoint**: US1 — fio de uma conversa contra um `fetch` fake; ainda sem raciocínio e sem cartão

---

## Phase 4: User Story 2 - Ver o raciocínio tipado (Priority: P1)

**Goal**: "ver raciocínio" abre e fecha o `trace` do turno, cada evento com os campos do seu `type`, sem novo `POST`.

**Independent Test**: `npm test --prefix web -- src/model/trace-lines.test.ts src/ui/WarRoom.test.tsx`. Um `200` com um evento de cada tipo lista os campos na ordem. Trace vazio explica que não há eventos. Fechar o painel deixa o `fetch` com a mesma contagem.

### Tests for User Story 2

- [X] T013 [P] [US2] Em `web/src/model/trace-lines.test.ts`: para cada tipo, as linhas batem com [data-model.md](data-model.md) (`content`; `tool` e `args` em JSON; `steps` em ordem; `route`, `reason`, `override` como `sim`/`não`; `from` e `to`). `node` não vazio sai como metadado. Tipo desconhecido vira uma linha com o JSON do evento e não descarta os vizinhos. Lista vazia devolve zero linhas
- [X] T014 [US2] Em `web/src/ui/WarRoom.test.tsx`: `200` cujo `trace` tem um evento `thought` e um `action` mostra o botão `ver raciocínio`. Ao acionar, aparecem `content`, `tool` e `args` nessa ordem; `aria-expanded` vai a `true`. Acionar de novo fecha o painel e o número de chamadas de `fetch` não muda. `trace: []` abre o texto de que não há eventos

### Implementation for User Story 2

- [X] T015 [US2] Implementar `traceLines` em `web/src/model/trace-lines.ts` conforme T013
- [X] T016 [US2] Em `web/src/ui/TracePanel.tsx` e no turno de resposta de `web/src/ui/WarRoom.tsx`, botão `ver raciocínio` com `aria-expanded`, painel fechado ao chegar o turno, campos de T015. Trace vazio mostra texto, não um bloco sem conteúdo. O clique não chama `postChat`

**Checkpoint**: US2 — o raciocínio do `200` abre e fecha na sala

---

## Phase 5: User Story 3 - 202 vira cartão aprovar/negar (Priority: P1)

**Goal**: `202` é um cartão com Aprovar (primária) e Negar (secundária). A escolha envia `{ conversationId, decision }` sem `message`. O servidor aceita esse corpo, não chama o modelo e responde `200` com `Aprovado.` ou `Negado.`.

**Independent Test**: `npm run test -- src/services/decision-turn.test.ts src/http/server.test.ts` e `npm test --prefix web -- src/ui/WarRoom.test.tsx`. O cartão não é erro. Cada botão dispara um único `POST`. `decision` inválida é `400`. Conversa inexistente é `404` e não grava pedido.

### Tests for User Story 3

- [X] T017 [P] [US3] Em `src/services/decision-turn.test.ts` (`node:test`): `decisionTurn("approve")` devolve `answer` `Aprovado.`, `trace` `[{ type: "answer", content: "Aprovado.", node: "decisao" }]` e `metrics` `{ llmCalls: 0, latencyMs: 0 }`. `deny` usa `Negado.` no `answer` e no `content`
- [X] T018 [P] [US3] Em `src/http/server.test.ts`, com a estratégia fake que já conta execuções: depois de um `200` que criou conversa, `POST /chat` `{ conversationId, decision: "approve" }` é `200` com `Aprovado.`, o trace de T017, `requestId` no corpo e em `X-Request-Id`, e a contagem da estratégia não sobe. `deny` devolve `Negado.`. `decision: "maybe"`, decisão sem `conversationId`, e corpo com `message` e `decision` juntos são `400` com `issues`. `conversationId` desconhecido é `404` `NOT_FOUND` e não cria linha de pedido no store injetado. O `200` de decisão grava o trace como os demais `200` ([contracts/chat-http.md](contracts/chat-http.md))
- [X] T019 [P] [US3] Em `web/src/ui/WarRoom.test.tsx`: `fetch` que responde `202` com `pendingAction.summary` `Abrir incidente no billing`, `conversationId` e `trace` vazio mostra esse resumo, os botões `Aprovar` e `Negar`, e não mostra estado de erro. `Aprovar` envia um único `POST` `{ conversationId, decision: "approve" }` sem `message`; `Negar` envia `deny`. Dois cliques seguidos em `Aprovar` continuam um único `fetch` de decisão. `202` sem `summary` mostra `Ação aguardando decisão` e os dois botões. O `200` seguinte à decisão entra no fio como answer e o cartão não oferece mais os botões

### Implementation for User Story 3

- [X] T020 [US3] Implementar `decisionTurn` em `src/services/decision-turn.ts` conforme T017. Função pura, sem IO
- [X] T021 [US3] Em `src/http/server.ts`, unir o schema estrito de mensagem ao schema estrito `{ conversationId, decision: "approve" | "deny" }` com `z.union`. No ramo `decision`, não chamar `executeTurn`. `lastMessages(conversationId, 1)` que lança `NotFoundError` responde `404` sem `save`. No sucesso, `save` do trace de `decisionTurn`, depois `append` da fala `Aprovar` ou `Negar` e da answer, e `finishPost` `200` com `conversationId`, `answer`, `trace` e `metrics` ([research.md](research.md) R4–R5)
- [X] T022 [US3] Em `web/src/ui/DecisionCard.tsx` e `web/src/ui/WarRoom.tsx`, renderizar o `202` como cartão (resumo ou `Ação aguardando decisão`, `requestId` em metadado, `Aprovar` primário, `Negar` secundário). Ao decidir, gravar a escolha, esconder os botões e enviar o corpo de T019 via `postChat`. "ver raciocínio" no cartão reutiliza `web/src/ui/TracePanel.tsx` quando houver `trace`

**Checkpoint**: US3 — o fake de `202` vira cartão; o Express aceita a decisão sem modelo

---

## Phase 6: User Story 4 - Engrenagem com a URL da API (Priority: P2)

**Goal**: A engrenagem grava uma URL absoluta `http` ou `https`. Ela sobrevive a uma nova montagem e passa a ser a base do `POST /chat`. URL inválida não apaga a última válida.

**Independent Test**: `npm test --prefix web -- src/model/settings.test.ts src/ui/WarRoom.test.tsx`. Remontar o componente continua chamando a URL salva. Valor vazio mantém `http://localhost:3000` ou a URL válida anterior.

### Tests for User Story 4

- [X] T023 [US4] Em `web/src/model/settings.test.ts`, com um `Storage` em memória: sem chave, a base é `http://localhost:3000` e o tema é `system`. `http://localhost:9090/` grava `opspilot.apiBase` sem barra final. `ftp://localhost`, string vazia e `localhost:3000` não gravam e devolvem a base anterior. `light`, `dark` e `system` gravam `opspilot.theme`; outro valor cai em `system`
- [X] T024 [US4] Em `web/src/ui/WarRoom.test.tsx`: o botão tem nome acessível `Configurar URL da API`. Confirmar `http://127.0.0.1:9090/` faz o envio seguinte ir a `http://127.0.0.1:9090/chat`. Desmontar e montar de novo continua nessa URL (`localStorage` do jsdom). Confirmar `não é url` mostra o erro no campo `URL da API` e o próximo envio permanece na URL anterior

### Implementation for User Story 4

- [X] T025 [US4] Implementar leitura e gravação em `web/src/model/settings.ts` conforme T023. Chaves `opspilot.apiBase` e `opspilot.theme`
- [X] T026 [US4] Em `web/src/ui/SettingsDialog.tsx` e `web/src/ui/WarRoom.tsx`, botão com nome acessível `Configurar URL da API`, campo com rótulo visível `URL da API` (placeholder não substitui o rótulo) e confirmação que chama T025. A sala usa essa base em `joinChatUrl`. Erro de URL fica associado ao campo pelo `id`. Ainda não é obrigatório o seletor de tema (US6)

**Checkpoint**: US4 — a URL da engrenagem é a base do chat e sobrevive à remontagem

---

## Phase 7: User Story 5 - Base /opspilot/ e CORS (Priority: P2)

**Goal**: A sala publica em `/opspilot/`. `OPTIONS /chat` e `POST /chat` com `Origin` deixam o navegador ler o JSON. Sem `Origin`, a resposta não ganha cabeçalho CORS.

**Independent Test**: `npm run test -- src/http/server.test.ts` e `npm test --prefix web -- src/base.test.ts`. Preflight `204` ecoa a origem e autoriza `POST` e `Content-Type`. `POST` com `Origin` inclui `Access-Control-Allow-Origin`. A config do Vite tem `base` `/opspilot/`.

### Tests for User Story 5

- [X] T027 [P] [US5] Em `src/http/server.test.ts`: `OPTIONS /chat` com `Origin: http://localhost:5173` e `Access-Control-Request-Method: POST` e `Access-Control-Request-Headers: content-type` responde `204`, `Access-Control-Allow-Origin` igual a essa origem, `Vary: Origin`, `Access-Control-Allow-Methods` contendo `POST` e `Access-Control-Allow-Headers` contendo `Content-Type`. Sem `Access-Control-Allow-Credentials`. Um `POST /chat` `200` com o mesmo `Origin` repete `Access-Control-Allow-Origin` e `Vary`. Um `POST` sem `Origin` não envia `Access-Control-Allow-Origin` ([contracts/chat-http.md](contracts/chat-http.md))
- [X] T028 [P] [US5] Em `web/src/base.test.ts`, importar `web/vite.config.ts` e afirmar `base === "/opspilot/"`

### Implementation for User Story 5

- [X] T029 [US5] Em `src/http/server.ts`, middleware antes das rotas, só no caminho `/chat`: se houver `Origin`, refletir em `Access-Control-Allow-Origin` e setar `Vary: Origin`. `OPTIONS` responde `204` sem corpo e sem `requestId`, com os `Allow-Methods` e `Allow-Headers` de T027. O `POST` (sucesso e erro) reutiliza o mesmo `Allow-Origin`. Não usar o pacote `cors` ([research.md](research.md) R3)

**Checkpoint**: US5 — outra origem lê o `/chat`; a sala está configurada em `/opspilot/`

---

## Phase 8: User Story 6 - Instructions de design (Priority: P2)

**Goal**: Tema claro, escuro ou sistema persiste neste navegador. Enviar, ver raciocínio, aprovar, negar e abrir a engrenagem funcionam pelo teclado, com nome acessível e foco visível.

**Independent Test**: `npm test --prefix web -- src/ui/WarRoom.test.tsx`. Tema `dark` grava `opspilot.theme` e põe `data-theme="dark"`. Remontar conserva o tema. Os controles da sala são alcançáveis pelo nome acessível. Erro e espera usam texto, não só cor.

### Tests for User Story 6

- [X] T030 [US6] Em `web/src/ui/WarRoom.test.tsx`: na engrenagem, escolher `dark` grava `opspilot.theme` e o documento fica `data-theme="dark"`. `system` remove `data-theme`. Remontar a sala conserva `dark`. `userEvent` aciona pelo teclado, via nome acessível, `ver raciocínio`, `Aprovar`, `Negar` e `Configurar URL da API`. O erro de rede e o estado de espera expõem texto (região `aria-live` ou texto visível), e o campo de mensagem continua com rótulo visível

### Implementation for User Story 6

- [X] T031 [US6] No diálogo de `web/src/ui/SettingsDialog.tsx`, seletor `light` / `dark` / `system` usando `web/src/model/settings.ts`. Aplicar ou remover `data-theme` no documento. Em `web/src/ui/WarRoom.tsx`, `web/src/ui/TracePanel.tsx` e `web/src/ui/DecisionCard.tsx`, garantir rótulo visível, `aria-live` no erro e na espera, alvo de clique com no mínimo 24px via as variáveis de espaço, e um único `h1`. Não introduzir margem fora da escala de `web/src/styles.css`

**Checkpoint**: US6 — tema persistido e controles operáveis pelo teclado

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Suíte inteira e quickstart.

- [X] T032 Executar `npm run typecheck` e `npm run test` até os dois saírem com exit 0. Conferir os sete itens de [quickstart.md](quickstart.md): CORS, decisão, fio, raciocínio, cartão, engrenagem e erro com retry

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências. T005 depois de T001 (os scripts de `web/package.json` precisam existir)
- **Foundational (Phase 2)**: Depois do Setup. Bloqueia US1, US2, US3 (sala), US4 e US6
- **US1 (Phase 3)**: Depois de T008 e T006. MVP
- **US2 (Phase 4)**: Depois da US1 (o painel entra no turno que a US1 desenha). `trace-lines` (T013–T015) não precisa da UI
- **US3 (Phase 5)**: `decision-turn` e o ramo HTTP não dependem da sala. O cartão depende da US1 e do painel da US2
- **US4 (Phase 6)**: Depois da US1 (o envio passa a usar a base gravada)
- **US5 (Phase 7)**: CORS depois do Setup. Não depende da sala. O teste de `base` depende de T003
- **US6 (Phase 8)**: Depois de US1, US2, US3 e US4 (os controles que o teclado aciona já existem)
- **Polish (Phase 9)**: Depois das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: Cliente `postChat` e os tokens. Não precisa de decisão nem de CORS
- **US2 (P1)**: A função de linhas é isolada. O botão na sala depende do fio da US1
- **US3 (P1)**: Testes de `decision-turn` e de `server.test.ts` são isolados da sala. O cartão depende do fio e reutiliza o painel da US2
- **US4 (P2)**: Independente no `settings.ts`. A prova na sala depende do envio da US1
- **US5 (P2)**: Independente da sala. Muda `src/http/server.ts`, o mesmo arquivo do ramo de decisão: fazer T029 depois de T021
- **US6 (P2)**: Fecha tema e teclado em cima dos controles das histórias anteriores

### Within Each User Story

- Testes primeiro (devem falhar) e implementação em seguida
- T007 antes de T008; T009 antes de T011; T010 antes de T012; T012 depois de T008 e T011
- T013 antes de T015; T014 antes de T016; T016 depois de T012 e T015
- T017 antes de T020; T018 antes de T021; T020 antes de T021; T019 antes de T022; T022 depois de T016
- T023 antes de T025; T024 antes de T026; T026 depois de T012 e T025
- T027 antes de T029; T029 depois de T021
- T030 antes de T031; T031 depois de T026 e T022

### Parallel Opportunities

- T001, T002, T003 e T004 em arquivos distintos
- T006 (`styles.css`) em paralelo com T007 (`chat.test.ts`)
- T009 (`thread.test.ts`) em paralelo com T010 (`WarRoom.test.tsx`)
- T013 (`trace-lines.test.ts`) em paralelo com a US1, depois da Phase 2
- T017, T018 e T019 em arquivos distintos, depois da US1 para o T019
- T020 (`decision-turn.ts`) em paralelo com T022 (sala), depois dos testes de cada um
- T027 (`server.test.ts`) em paralelo com T028 (`base.test.ts`)
- US5 (CORS) em paralelo com US2 e US4, desde que T021 já tenha ocupado `server.ts` antes de T029

---

## Parallel Example: User Story 3

```bash
# Testes em arquivos distintos:
Task: "T017 decisionTurn em src/services/decision-turn.test.ts"
Task: "T018 decisão HTTP em src/http/server.test.ts"
Task: "T019 cartão 202 em web/src/ui/WarRoom.test.tsx"

# Implementação em arquivos distintos, depois do teste de cada um:
Task: "T020 decisionTurn em src/services/decision-turn.ts"
Task: "T022 DecisionCard em web/src/ui/DecisionCard.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 US1
4. **STOP**: `npm test --prefix web -- src/ui/WarRoom.test.tsx` verde para sala vazia, `200` e segundo turno com `conversationId`
5. Seguir US2 (trace) → US3 (cartão e decisão) → US4 (engrenagem) → US5 (CORS) → US6 (tema e teclado) → Polish

### Incremental Delivery

1. Setup + Foundational → pacote `web/` e cliente de status
2. US1 → fio de conversa (MVP)
3. US2 → "ver raciocínio" tipado
4. US3 → cartão do `202` e `200` de decisão sem modelo
5. US4 → URL persistida
6. US5 → `/opspilot/` e CORS
7. US6 → tema e teclado
8. Polish → `npm run typecheck` e `npm run test` verdes

### Parallel Team Strategy

1. Juntos: Setup + Foundational
2. Dev A: US1 em `web/src/ui/WarRoom.tsx`
3. Em paralelo com a US1: Dev B em `trace-lines` (T013–T015) e Dev C em `decision-turn` mais o ramo HTTP (T017, T018, T020, T021)
4. Depois do fio: cartão (T022), engrenagem (T026) e CORS (T029) — T021 e T029 no mesmo `server.ts`, em sequência

---

## Notes

- [P] = arquivos distintos, sem dependência incompleta
- A sala não envia `strategy`, `reflect` nem `userId`. A decisão não envia `message`
- Este processo não responde `202`. O cartão é provado com `fetch` fake
- `decisionTurn` não chama modelo. Conversa ausente é `404` sem `save`
- CORS só em `/chat`, refletindo `Origin`, sem credencial
- Commit após cada tarefa ou grupo lógico; marcar `[x]` em `tasks.md` na implementação
