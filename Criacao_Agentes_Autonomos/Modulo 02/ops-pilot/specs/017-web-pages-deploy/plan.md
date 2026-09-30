# Implementation Plan: Deploy da war room no Pages

**Branch**: `017-web-pages-deploy` | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-web-pages-deploy/spec.md`

## Summary

Um workflow na raiz do git publica o `web/` do OpsPilot no GitHub Pages. O token só lê o repositório, escreve Pages e assina o deploy. O build usa `vite build --base /<repo>/opspilot/` e o artefato coloca o `dist` em `_site/opspilot/`, enviado por `actions/upload-pages-artifact` e publicado por `actions/deploy-pages`. O `base` local continua `/opspilot/`. O README na raiz do OpsPilot explica a sala local, a URL publicada e a engrenagem da API.

## Technical Context

**Language/Version**: YAML do Actions. Build com Node.js 22 e o Vite já usado em `web/`.

**Primary Dependencies**: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`. Nenhuma dependência nova de runtime.

**Storage**: Nenhum. O artefato é o `dist` do Vite, descartado no runner.

**Testing**: Vitest em ambiente Node, no `npm test` que já encadeia `web/`. Lê o workflow e o README e roda um build com `--base /exemplo/opspilot/` em diretório temporário. Sem chamada ao GitHub.

**Target Platform**: GitHub Actions (`ubuntu-latest`) publicando GitHub Pages de projeto. Desenvolvimento continua em `http://localhost:5173/opspilot/`.

**Project Type**: Pipeline de publicação do aplicativo web já existente, mais o README do OpsPilot.

**Performance Goals**: Um build do Vite por execução. Sem teste de carga.

**Constraints**: Permissões só as três da spec. Base local `/opspilot/` intocada. Artefato sem API, `node_modules` nem `.env`. Push só em `main`, mais `workflow_dispatch`. Concorrência `pages` sem cancelar publicação em andamento.

**Scale/Scope**: Um workflow, um script `build` em `web/package.json`, um teste e um README.

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: não há código de domínio. O build é o Vite já existente; o workflow só o invoca.
- [x] **II. Validação na fronteira**: não há entrada HTTP nova. A base de produção é um argumento do build, conferido pelo `index.html` gerado.
- [x] **III. Erros de domínio**: falha de `npm ci` ou do build interrompe o job antes de `deploy-pages`. Não há erro de domínio novo.
- [x] **IV. Teste é parte da tarefa**: workflow, build com base de exemplo e README entram no `npm test`. `npm run typecheck` segue verde.
- [x] **V. Segurança por padrão**: token sem escrita no git. README e artefato sem segredo nem `.env`.
- [x] **VI. Spec antes do código**: spec + este plano.
- [x] **VII. Persistência embarcada**: nenhum banco e nenhuma tabela.

O workflow fica na raiz do git porque o Actions não executa workflow aninhado no OpsPilot. Isso não cria um segundo backend.

## Project Structure

### Documentation (this feature)

```text
specs/017-web-pages-deploy/
├── checklists/requirements.md
├── contracts/
│   ├── pages-workflow.md
│   └── readme.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
.github/workflows/pages.yml          # NOVO, na raiz do git (Pratica/)
Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/
├── README.md                         # NOVO
└── web/
    ├── package.json                  # script build
    └── src/pages-publish.test.ts     # NOVO: workflow, build, README
```

**Structure Decision**: O YAML sai da pasta do OpsPilot e vai para a raiz do repositório `engenharia-ia-aplicada`, único lugar que o Actions lê. O app, o teste e o README permanecem no OpsPilot. O `dist` e o `_site` nascem no runner.

## Phase 0: Research

Decisões em [research.md](research.md): workflow na raiz do git; base `/<repo>/opspilot/` só no build, com o `dist` em `_site/opspilot/`; um job com as actions pedidas e `configure-pages` antes do upload; teste local sem GitHub; README na raiz do OpsPilot.

## Phase 1: Design & Contracts

- Modelo: [data-model.md](data-model.md)
- Contratos: [contracts/pages-workflow.md](contracts/pages-workflow.md), [contracts/readme.md](contracts/readme.md)
- Validação: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Acrescentar `"build": "vite build"` em `web/package.json`.
2. Escrever `web/src/pages-publish.test.ts` (ambiente Node): texto do workflow na raiz do git; build em diretório temporário com `--base /exemplo/opspilot/` e `index.html` com `/opspilot/` nos scripts e estilos; README com as frases do contrato e sem segredo. O teste falha até os arquivos existirem.
3. Criar `.github/workflows/pages.yml` na raiz do git conforme [contracts/pages-workflow.md](contracts/pages-workflow.md).
4. Criar `README.md` na raiz do OpsPilot conforme [contracts/readme.md](contracts/readme.md).
5. `npm run typecheck` e `npm run test` verdes.

## Complexity Tracking

Nenhuma violação constitucional. O workflow na raiz do git é a condição para o Pages rodar; o OpsPilot continua sendo o aplicativo.
