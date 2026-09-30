# Implementation Plan: War room web

**Branch**: `016-war-room-web` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-war-room-web/spec.md`

## Summary

A war room é um aplicativo Vite, React e TypeScript em `web/`, servido em `/opspilot/`. O plantonista envia mensagens para `POST {api}/chat`, abre o trace por tipo em "ver raciocínio" e vê um `202` como cartão de Aprovar ou Negar. A engrenagem guarda a URL da API e o tema neste navegador. O Express passa a refletir o `Origin` em `/chat` e a aceitar um corpo de decisão, respondendo `200` determinístico sem chamar o modelo. O processo não emite `202`.

## Technical Context

**Language/Version**: TypeScript strict. API em Node.js 22 LTS (ESM). Sala em TypeScript no browser, compilada pelo Vite.

**Primary Dependencies**: Express e Zod na API. Vite, React e Vitest em `web/`. Sem pacote novo de CORS.

**Storage**: Nenhum schema novo. O `200` de decisão reutiliza `requests` e `trace_events`. A sala persiste `opspilot.apiBase` e `opspilot.theme` no `localStorage`.

**Testing**: `node:test` + `tsx` para CORS e decisão em `src/http/server.test.ts`. Vitest + jsdom + Testing Library em `web/`, com `fetch` fake. Os dois entram em `npm run test`. `npm run typecheck` roda o `tsc` da raiz e o de `web/`.

**Target Platform**: Navegador para a sala (dev em `http://localhost:5173/opspilot/`). API no processo já existente (`src/index.ts`, porta 3000).

**Project Type**: Web application (sala nova + extensão do `POST /chat`)

**Performance Goals**: Um `POST` por envio ou decisão. A decisão não chama modelo. O painel de trace só formata o array já recebido.

**Constraints**: Base `/opspilot/`. Corpo de mensagem continua estrito. Decisão sem `message`. `202` só é consumido. Escala de espaçamento e tokens das instructions de design. Sem segredo e sem credencial CORS.

**Scale/Scope**: Uma página, um cliente de chat, o middleware CORS e o ramo de decisão no handler já existente.

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: Zod e HTTP ficam na borda. `decisionTurn` é função pura (texto, trace e métricas) e não faz IO. A sala separa formatação do trace e da URL dos componentes. O grafo não participa da decisão.
- [x] **II. Validação na fronteira**: mensagem e decisão são objetos Zod estritos. A URL da API é validada antes de gravar. Mensagem em branco nem sai do browser.
- [x] **III. Erros de domínio**: conversa ausente na decisão reutiliza `NotFoundError` e o `404` já mapeado. `decision` inválida é `400` de Zod, não erro de domínio.
- [x] **IV. Teste é parte da tarefa**: suíte da API e suíte da sala, sem modelo e sem rede. `npm run typecheck` inclui `web/`.
- [x] **V. Segurança por padrão**: nenhum segredo. CORS sem credencial. A sala só guarda URL e tema.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência embarcada**: nenhuma tabela nova e nenhum outro banco. O `200` de decisão passa pelo `RequestTraceStore` já existente.

Vite e React entram porque a spec exige o aplicativo em `web/`. O gate da constituição continua sendo os scripts da raiz.

## Project Structure

### Documentation (this feature)

```text
specs/016-war-room-web/
├── checklists/requirements.md
├── contracts/
│   ├── chat-http.md
│   └── war-room-ui.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── services/
│   └── decision-turn.ts          # NOVO: answer, trace e metrics da decisão
├── http/
│   ├── server.ts                 # CORS, união Zod, ramo decision
│   └── server.test.ts
web/                                # NOVO pacote
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts                  # base /opspilot/
└── src/
    ├── main.tsx
    ├── styles.css                  # tokens e escala
    ├── api/chat.ts                 # URL, POST, leitura de status
    ├── model/trace-lines.ts        # evento → linhas
    ├── model/settings.ts           # URL, tema, localStorage
    └── ui/                         # sala, cartão, trace, engrenagem, estados
package.json                        # typecheck e test encadeiam web/
```

**Structure Decision**: Dois projetos no mesmo repositório. A API permanece em `src/` com o layout MVC atual. A sala fica isolada em `web/` para o TypeScript do browser não entrar no `tsc` NodeNext. O Express não serve o estático; no dev, Vite e API rodam em portas diferentes e o CORS liga os dois.

## Phase 0: Research

Decisões em [research.md](research.md): pacote `web/` com base `/opspilot/`; Vitest no gate da raiz; CORS refletindo `Origin` só em `/chat`; união de schemas estritos; decisão sem modelo e sem `202` neste processo; `localStorage` para URL e tema; trace formatado por função pura.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/chat-http.md](contracts/chat-http.md), [contracts/war-room-ui.md](contracts/war-room-ui.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. `decisionTurn(decision)` puro e testável: `approve` → `Aprovado.`; `deny` → `Negado.`; trace com `node: "decisao"`; métricas zeradas.
2. Em `createChatServer`, middleware de CORS para `/chat` e `OPTIONS` `204`. Estender `server.test.ts` com preflight, `POST` com `Origin` e pedido sem `Origin`.
3. Unir o schema de mensagem ao de decisão. Ramo `decision`: `lastMessages` para existir a conversa, `save` do trace, `append` das duas falas, `finishPost` `200`. Não chamar `executeTurn`. Testes de `200`, `400` e `404`.
4. Criar `web/` (Vite, React, TypeScript, `base: "/opspilot/"`). Tokens e escala em `styles.css`, conforme `.github/instructions/design.instructions.md`.
5. Funções puras de URL, tema e linhas de trace, com teste Vitest.
6. Sala: estado vazio, compositor, fio, "ver raciocínio", cartão `202`, erro com retry, engrenagem e tema. Testes com `fetch` fake cobrindo FR-013 da interface.
7. Encadear `web` em `npm run typecheck` e `npm run test` na raiz.
8. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional. O pacote `web/` é o aplicativo que a spec pede, não um segundo backend.
