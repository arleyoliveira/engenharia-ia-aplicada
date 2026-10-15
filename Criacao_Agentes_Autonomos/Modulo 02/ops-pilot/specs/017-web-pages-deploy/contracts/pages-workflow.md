# Contract: Workflow de Pages

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md)

Arquivo na raiz do git: `.github/workflows/pages.yml`. Um job. Falha em `npm ci` ou no build impede os passos seguintes, inclusive `deploy-pages`.

```yaml
name: Publish war room

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web/package-lock.json
      - uses: actions/configure-pages@v5
      - name: Build war room
        working-directory: Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web
        run: |
          npm ci
          repo="${GITHUB_REPOSITORY##*/}"
          repo="$(printf '%s' "$repo" | tr '[:upper:]' '[:lower:]')"
          npm run build -- --base "/${repo}/opspilot/"
      - name: Stage /opspilot/
        run: |
          src="Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web/dist"
          mkdir -p "$GITHUB_WORKSPACE/_site/opspilot"
          cp -a "$src"/. "$GITHUB_WORKSPACE/_site/opspilot/"
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
```

`working-directory` e o caminho com espaço vão entre aspas no YAML real. O bloco `permissions` não inclui outra chave. `contents` não é `write`.

`page_url` é a raiz do site (`https://<owner>.github.io/<repo>/`). A sala é essa URL mais `opspilot/`.

O script `build` em `web/package.json` é `vite build`. A flag `--base` substitui o `base` de `web/vite.config.ts` só nessa execução.
