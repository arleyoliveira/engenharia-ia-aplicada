# Quickstart: Deploy da war room no Pages

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

Validação sem publicar no GitHub. Contratos: [pages-workflow.md](contracts/pages-workflow.md), [readme.md](contracts/readme.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22
- Dependências de `web/` instaladas (`npm ci --prefix web`)

## Suíte

```bash
npm run typecheck
npm run test
```

Os dois comandos terminam com exit 0. O teste novo vive em `web/` e entra no `npm test` da raiz.

## O que a suíte prova

1. **Workflow.** `.github/workflows/pages.yml` na raiz do git declara `contents: read`, `pages: write`, `id-token: write`, `actions/upload-pages-artifact`, `actions/deploy-pages`, `actions/configure-pages`, grupo `pages`, `cancel-in-progress: false`, branch `main`, `workflow_dispatch` e ambiente `github-pages`. Não declara `contents: write`.
2. **Build de produção.** `npm run build --prefix web -- --base /exemplo/opspilot/` grava um `index.html` em diretório temporário. Cada `script src` e cada `link href` contém `/opspilot/`. `web/vite.config.ts` continua com `base` `/opspilot/`.
3. **README.** `README.md` na raiz do OpsPilot cita `http://localhost:5173/opspilot/`, `https://<owner>.github.io/<repo>/opspilot/`, GitHub Actions e a engrenagem da URL da API. Não contém segredo.

## Ensaio manual (opcional)

Na raiz do git, conferir que o Pages do repositório usa a origem GitHub Actions. Um push em `main`, ou um `workflow_dispatch`, deixa a sala em `https://<owner>.github.io/<repo>/opspilot/`. A engrenagem aponta para a API, que não é servida por esse site. Isso não faz parte do gate.
