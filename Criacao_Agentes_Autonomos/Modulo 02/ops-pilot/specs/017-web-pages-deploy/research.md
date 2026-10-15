# Research: Deploy da war room no Pages

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

## R1. Onde o workflow mora

- **Decision**: O arquivo é `.github/workflows/pages.yml` na raiz do git (`Pratica/`, repositório `engenharia-ia-aplicada`). O job entra em `Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web`. O caminho leva aspas por causa do espaço em `Modulo 02`.
- **Rationale**: O Actions só carrega workflows da raiz do repositório. Um `.github/workflows` dentro do OpsPilot não publica. A spec pede `.github/workflows/pages.yml` nesse repositório.
- **Alternatives considered**: Workflow dentro de `ops-pilot/.github` (o GitHub ignora); repositório separado só da sala (fora do remoto atual).

## R2. Base local e base publicada

- **Decision**: `web/vite.config.ts` permanece com `base: "/opspilot/"`. O workflow chama `npm run build -- --base "/<repo>/opspilot/"`, com `<repo>` igual a `${GITHUB_REPOSITORY##*/}` em minúsculas. O `dist` é copiado para `_site/opspilot/` e esse `_site` é o `path` de `actions/upload-pages-artifact`. A URL fica `https://<owner>.github.io/<repo>/opspilot/`.
- **Rationale**: O Pages de projeto serve o artefato em `/<repo>/`. A base `/opspilot/` sozinha apontaria para `https://<owner>.github.io/opspilot/`, fora do site. Juntar o nome do repositório só no build deixa o teste de `web/src/base.test.ts` intacto. Copiar o `dist` para a pasta `opspilot/` faz o arquivo existir no mesmo caminho que a base absoluta pede.
- **Alternatives considered**: Mudar o `base` commitado para `/engenharia-ia-aplicada/opspilot/` (quebra o dev em `/opspilot/` e grava o nome do remoto); publicar o `dist` na raiz do artefato com base `/<repo>/` (a URL não termina em `/opspilot/`).

## R3. Actions, permissões e falha de build

- **Decision**: Um único job `deploy` em `ubuntu-latest`, ambiente `github-pages`. Permissões no topo do workflow, só `contents: read`, `pages: write`, `id-token: write`. Ordem: `actions/checkout@v4`, `actions/setup-node@v4` (Node 22), `npm ci` em `web/`, build, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` (`path: _site`), `actions/deploy-pages@v4` com `id: deployment`. Concorrência `group: pages` e `cancel-in-progress: false`. Gatilho: `push` em `main` e `workflow_dispatch`.
- **Rationale**: Passos no mesmo job param na primeira falha, então `deploy-pages` não corre se `npm ci` ou o build falham. `configure-pages` prepara o ambiente e não substitui as duas actions pedidas. As majors são as do starter oficial de Pages. O token não ganha escrita no git.
- **Alternatives considered**: Dois jobs com `needs` (o mesmo efeito, mais YAML); `contents: write` (a spec fecha a lista); filtro `paths` (um push em `main` deixaria de publicar se não tocasse `web/`).

## R4. O que entra no artefato

- **Decision**: Só o conteúdo de `web/dist`, colocado em `_site/opspilot/` no runner. `_site` não é commitado. `npm ci` usa `web/package-lock.json`. O script `build` novo em `web/package.json` é `vite build`.
- **Rationale**: O `dist` é HTML, JS e CSS emitidos pelo Vite. Não há `node_modules`, `.env` nem código de `src/`. O lockfile já existe em `web/`.
- **Alternatives considered**: Subir o diretório `web/` inteiro (vazaria dependências e config); build na raiz do monorepo (o `package.json` da raiz não gera a sala).

## R5. Como o teste prova sem o GitHub

- **Decision**: Um teste Vitest em ambiente Node lê o workflow caminhando até a raiz do git e exige as permissões, as actions, o grupo `pages`, `cancel-in-progress: false`, `main`, `workflow_dispatch` e `github-pages`. Outro caso roda `npm run build -- --base /exemplo/opspilot/` com `outDir` num diretório temporário e exige que cada `script src` e cada `link href` do `index.html` contenha `/opspilot/`. O teste do README lê `README.md` na raiz do OpsPilot.
- **Rationale**: A spec pede verificação sem publicar. O build com `/exemplo/opspilot/` exercita a mesma flag que o Actions usa, sem depender de `GITHUB_REPOSITORY`.
- **Alternatives considered**: Só inspeção manual do YAML (não entra em `npm test`); parser de YAML novo (as chaves pedidas cabem em asserção de texto).

## R6. README

- **Decision**: Criar `README.md` na raiz do OpsPilot (ao lado de `web/` e `package.json`). Seções: o que é a sala; `npm run dev` na API (porta 3000) e `npm run dev --prefix web` em `http://localhost:5173/opspilot/`; URL `https://<owner>.github.io/<repo>/opspilot/`; origem do Pages em GitHub Actions; engrenagem para a URL da API; o Pages não hospeda a API. Sem valor de segredo, sem conteúdo de `.env`.
- **Rationale**: Não existe README hoje. Criar o arquivo cumpre "atualizar". O monorepo não recebe um README novo na raiz do git.
- **Alternatives considered**: README na raiz de `Pratica` (não é a raiz do OpsPilot que a spec nomeia).
