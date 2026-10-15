# Implementation Plan: Respostas em Markdown na war room

**Branch**: `019-chat-markdown-render` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-chat-markdown-render/spec.md`

## Summary

O plantonista vê o campo `answer` do assistente formatado como Markdown no balão da war room (`web/`), em vez de texto cru num único `<p>`. A API não muda: `answer` segue string. A implementação adiciona `react-markdown`, `remark-gfm` e `rehype-sanitize` em `web/`, um componente `AnswerBody`, funções puras para cabeçalhos e URLs, estilos `.answer-md` com tokens existentes, e testes Vitest que cobrem estrutura, prosa, segurança e regressão da sala.

## Technical Context

**Language/Version**: TypeScript strict no pacote `web/` (React 19, Vite 7). Node 22 na raiz; sem alteração em `src/` da API.

**Primary Dependencies**: Novas em `web/`: `react-markdown`, `remark-gfm`, `rehype-sanitize`. Demais dependências da war room inalteradas.

**Storage**: N/A. Nenhum `localStorage` ou SQLite novo.

**Testing**: Vitest + jsdom + Testing Library em `web/` para `AnswerBody` e regressão em `WarRoom.test.tsx`. Funções puras em `answer-markdown.test.ts`. Gate raiz: `npm run typecheck` e `npm run test`.

**Target Platform**: Navegador (war room em `/opspilot/`).

**Project Type**: Incremento no frontend existente (`web/`); backend untouched.

**Performance Goals**: Parse Markdown por turno no render; volume típico de resposta de chat (até dezenas de KB) sem truncar (spec).

**Constraints**: FR-003/004 sanitização e links; sem `<h1>` no balão; mensagens do usuário sem Markdown; trace e cartão `202` texto plano; design tokens e escala 4–48.

**Scale/Scope**: Um componente novo, um módulo puro, CSS adicional, substituição de uma linha em `WarRoom.tsx`, quatro dependências npm em `web/`.

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: Regras de heading/URL em funções puras (`answer-markdown.ts`); IO permanece só em `postChat`. API e domínio Node não ganham lógica de Markdown.
- [x] **II. Validação na fronteira**: Entrada HTTP inalterada; validação Zod existente continua. URLs de link validadas na borda da renderização (cliente).
- [x] **III. Erros de domínio**: N/A no servidor; falha de parse Markdown no cliente é best-effort, sem erro de domínio.
- [x] **IV. Teste é parte da tarefa**: Novos testes Vitest + gate raiz verde (FR-010).
- [x] **V. Segurança por padrão**: Sanitização rehype + filtro de esquema de link; sem segredo; sem imagens remotas.
- [x] **VI. Spec antes do código**: spec 019 + este plano.
- [x] **VII. Persistência embarcada**: Nenhuma mudança de store.

## Project Structure

### Documentation (this feature)

```text
specs/019-chat-markdown-render/
├── checklists/requirements.md
├── contracts/
│   ├── answer-markdown-ui.md
│   └── chat-http.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
web/
├── package.json                    # + react-markdown, remark-gfm, rehype-sanitize
└── src/
    ├── model/
    │   ├── answer-markdown.ts      # NOVO: shift heading, isSafeHref, política img
    │   └── answer-markdown.test.ts
    ├── ui/
    │   ├── AnswerBody.tsx          # NOVO: Markdown + componentes custom
    │   ├── AnswerBody.test.tsx
    │   └── WarRoom.tsx             # <AnswerBody answer={turn.answer} />
    └── styles.css                  # .answer-md e filhos
```

**Structure Decision**: Toda a feature fica em `web/`. O layout MVC da sala (modelo de fio + componentes) é preservado; só o corpo do turno `answer` ganha pipeline de apresentação.

## Phase 0: Research

Decisões consolidadas em [research.md](research.md): stack remark/rehype; deslocamento de cabeçalhos; links e imagens; tokens CSS; estratégia de testes.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/answer-markdown-ui.md](contracts/answer-markdown-ui.md), [contracts/chat-http.md](contracts/chat-http.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Adicionar dependências em `web/package.json` e instalar.
2. Implementar `answer-markdown.ts` (mapa `h1`→`h2` …, `isSafeHref`) com testes puros.
3. Implementar `AnswerBody.tsx` (`ReactMarkdown`, `remarkGfm`, `rehypeSanitize`, componentes `a`, headings, `img`, `code`/`pre`).
4. Estender `styles.css` com `.answer-md` (espaçamento da escala, código, links, tabelas opcionais).
5. Trocar em `WarRoom.tsx` o `<p>{turn.answer}</p>` por `<AnswerBody />`; manter `requestId` e `TracePanel` abaixo.
6. Testes de contrato em `AnswerBody.test.tsx`; smoke/regressão nos cenários críticos de `WarRoom.test.tsx` se necessário.
7. `npm run typecheck` e `npm run test` na raiz verdes.

## Complexity Tracking

Nenhuma violação constitucional. Três dependências npm no frontend são o custo explícito de sanitização e GFM testável; parser manual foi rejeitado (ver R1).
