# Data Model: Deploy da war room no Pages

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Não há tabela nem estado no servidor. O que esta feature grava é o workflow, o script de build e o README. O site publicado é um diretório estático.

## Workflow de Pages

Arquivo: `.github/workflows/pages.yml` na raiz do git.

| Campo | Valor |
| --- | --- |
| Gatilho | `push` em `main`; `workflow_dispatch` |
| Permissões | `contents: read`, `pages: write`, `id-token: write` |
| Concorrência | grupo `pages`, `cancel-in-progress: false` |
| Job | `deploy`, `ubuntu-latest`, ambiente `github-pages` |
| Node | 22 |
| Diretório de build | `Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web` |
| Base de produção | `/` + nome do repositório em minúsculas + `/opspilot/` |

O nome do repositório é a parte depois de `/` em `GITHUB_REPOSITORY`. `Engenharia-IA` vira `engenharia-ia`.

## Artefato da sala

No runner, depois do build:

```text
_site/
└── opspilot/
    ├── index.html
    └── assets/
```

`_site` é a raiz enviada ao Pages. A sala pública é `https://<owner>.github.io/<repo>/opspilot/`. Os `src` e `href` do `index.html` usam a base `/<repo>/opspilot/`, então apontam para essa pasta.

O `dist` do Vite não entra no git. `_site` também não.

## Base em dois modos

| Modo | Base | Onde |
| --- | --- | --- |
| Desenvolvimento | `/opspilot/` | `web/vite.config.ts`, sem flag |
| Pages | `/<repo>/opspilot/` | argumento `--base` só no workflow e no teste de build |

## README do OpsPilot

Arquivo: `README.md` ao lado de `web/` e `package.json`.

| Seção | Tem que dizer |
| --- | --- |
| Sala local | API com `npm run dev` (porta 3000) e sala com `npm run dev --prefix web` em `http://localhost:5173/opspilot/` |
| Sala publicada | `https://<owner>.github.io/<repo>/opspilot/` |
| Pages | origem do site em GitHub Actions |
| API | a engrenagem guarda a URL; o Pages não hospeda a API |

Sem segredo, token ou corpo de `.env`.
