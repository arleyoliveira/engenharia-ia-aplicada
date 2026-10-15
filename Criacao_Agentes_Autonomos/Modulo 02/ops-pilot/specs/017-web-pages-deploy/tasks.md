---

description: "Task list for publishing the OpsPilot war room on GitHub Pages"
---

# Tasks: Deploy da war room no Pages

**Input**: Design documents from `/specs/017-web-pages-deploy/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, constitution

**Tests**: A spec pede verificação sem publicar no GitHub (FR-009). Um teste Vitest em ambiente Node lê o workflow, roda o build com base de exemplo e lê o README. Sem parser de YAML novo e sem chamada ao GitHub. Ver [contracts/pages-workflow.md](contracts/pages-workflow.md), [contracts/readme.md](contracts/readme.md) e [quickstart.md](quickstart.md).

**Organization**: Por história. US1 e US2 são P1. US3 é P2. O workflow é um arquivo só e mora na raiz do git, não dentro do OpsPilot.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos distintos, sem dependência incompleta)
- **[Story]**: US1 / US2 / US3
- Incluir caminhos de arquivo exatos

## Path Conventions

- Sala e teste: pacote `web/` do OpsPilot (`web/src/pages-publish.test.ts`, Vitest)
- Workflow: `.github/workflows/pages.yml` na raiz do git (`Pratica/`), que é `../../../.github/workflows/pages.yml` a partir do OpsPilot
- README: `README.md` na raiz do OpsPilot, ao lado de `web/` e `package.json`
- Não criar `ops-pilot/.github/workflows/` nem um README novo na raiz do git

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: O script que o workflow e o teste de build invocam. Nenhuma dependência nova.

- [X] T001 Acrescentar `"build": "vite build"` aos scripts de `web/package.json`. Não mudar `dev`, `typecheck` nem `test`. Não editar `base` em `web/vite.config.ts`

**Checkpoint**: `npm run build --prefix web -- --base /exemplo/opspilot/` é um comando que o Vite aceita. Ainda não há workflow nem README

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Nada a criar. O que as histórias usam já está na feature 016.

**⚠️ CRITICAL**: Não alterar estes dois artefatos ao implementar as histórias

- `web/package-lock.json` existe e é o que `npm ci` do workflow instala
- `web/vite.config.ts` permanece com `base: "/opspilot/"`. `web/src/base.test.ts` continua passando

**Checkpoint**: Fundação pronta. US1 pode começar

---

## Phase 3: User Story 1 - Publicar a war room com as actions de Pages (Priority: P1) 🎯 MVP

**Goal**: Um workflow na raiz do git observa `main` e `workflow_dispatch`, limita o token às três permissões e publica com `actions/upload-pages-artifact` e `actions/deploy-pages`.

**Independent Test**: O teste de workflow em `web/src/pages-publish.test.ts` lê `.github/workflows/pages.yml` na raiz do git e confere gatilho, permissões, actions e concorrência. Não chama o GitHub.

### Tests for User Story 1

> Escrever primeiro. O caso falha enquanto `pages.yml` não existir na raiz do git.

- [X] T002 [US1] Criar `web/src/pages-publish.test.ts` com `// @vitest-environment node` na primeira linha, Vitest (`describe`, `expect`, `it`). Achar a raiz do git subindo diretórios a partir de `import.meta.url` até existir `.git`. Ler `.github/workflows/pages.yml` nessa raiz (não dentro do OpsPilot). Sem parser de YAML: asserções no texto. Exigir `name: Publish war room`, `workflow_dispatch`, `branches: [main]`, `contents: read`, `pages: write`, `id-token: write`, `group: pages`, `cancel-in-progress: false`, job `deploy`, `runs-on: ubuntu-latest`, ambiente `github-pages`, `actions/checkout@v4`, `actions/setup-node@v4`, `node-version: 22`, `cache: npm`, `cache-dependency-path` apontando para `Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web/package-lock.json`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` com `path: _site`, `actions/deploy-pages@v4` com `id: deployment`. O bloco entre `permissions:` e `concurrency:` só tem essas três chaves. O texto não contém `contents: write` nem `continue-on-error`. `working-directory` do build está entre aspas e vale `Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web`. O passo de build contém `npm ci` e `npm run build -- --base` com `opspilot`. O passo de stage copia para `$GITHUB_WORKSPACE/_site/opspilot` ([contracts/pages-workflow.md](contracts/pages-workflow.md), [research.md](research.md) R1, R3, R5)

### Implementation for User Story 1

- [X] T003 [US1] Criar `.github/workflows/pages.yml` na raiz do git com o YAML de [contracts/pages-workflow.md](contracts/pages-workflow.md). Colocar entre aspas `working-directory` e qualquer caminho que contenha o espaço de `Modulo 02`. Um único job `deploy`: falha em `npm ci` ou no build não chega a `deploy-pages`. `actions/configure-pages@v5` roda antes do upload e não substitui `actions/upload-pages-artifact@v3` nem `actions/deploy-pages@v4`. Permissões só `contents: read`, `pages: write`, `id-token: write`. Incluir já os passos `Build war room` e `Stage /opspilot/` do contrato (a US2 confere a base; não criar um segundo workflow)

**Checkpoint**: US1 — o teste de T002 passa. O arquivo ainda não foi executado no GitHub

---

## Phase 4: User Story 2 - A sala publicada abre em /opspilot/ (Priority: P1)

**Goal**: O build de produção prefixa os assets com `/<repositório>/opspilot/` e o artefato coloca o `dist` em `_site/opspilot/`. O `base` local continua `/opspilot/`.

**Independent Test**: `npm test --prefix web -- src/pages-publish.test.ts` gera `index.html` num diretório temporário com `--base /exemplo/opspilot/`. Cada `script src` e cada `link href` contém `/opspilot/`. `web/vite.config.ts` segue com `base` `/opspilot/`.

### Tests for User Story 2

- [X] T004 [US2] No mesmo `web/src/pages-publish.test.ts`, acrescentar um caso que, com `cwd` em `web/`, executa `npm run build -- --base /exemplo/opspilot/ --outDir <diretório temporário> --emptyOutDir` (`node:child_process`, exit 0). Ler o `index.html` gerado. Exigir ao menos um `script` com `src` e um `link` com `href`, e que cada um desses valores contenha `/opspilot/`. Não afirmar a raiz do host. Não publicar no GitHub ([research.md](research.md) R2, R5)

### Implementation for User Story 2

- [X] T005 [US2] Manter `base: "/opspilot/"` em `web/vite.config.ts` (não editar se já for esse valor; `web/src/base.test.ts` permanece verde). Em `.github/workflows/pages.yml`, o passo `Build war room` deriva o nome com `repo="${GITHUB_REPOSITORY##*/}"` e `tr '[:upper:]' '[:lower:]'`, e chama `npm run build -- --base "/${repo}/opspilot/"`. O passo `Stage /opspilot/` copia o conteúdo de `Criacao_Agentes_Autonomos/Modulo 02/ops-pilot/web/dist` para `$GITHUB_WORKSPACE/_site/opspilot/`. O upload continua com `path: _site`. Se T003 já gravou o contrato inteiro, não duplicar o arquivo

**Checkpoint**: US1 e US2 — workflow no texto e build local com a base de exemplo. A raiz do site Pages não redireciona

---

## Phase 5: User Story 3 - O README explica a sala local e a publicada (Priority: P2)

**Goal**: Quem abre o README do OpsPilot acha a sala local, a URL publicada e o fato de a API ficar na engrenagem.

**Independent Test**: O caso de README em `web/src/pages-publish.test.ts` acha as frases do contrato em `README.md` na raiz do OpsPilot e não acha segredo. Sem abrir o workflow.

### Tests for User Story 3

> Escrever antes do README. O caso falha enquanto o arquivo não existir.

- [X] T006 [US3] No mesmo `web/src/pages-publish.test.ts`, ler `README.md` na raiz do OpsPilot (diretório de `web/` e `package.json`, não a raiz do git). Exigir as frases `npm run dev`, `npm run dev --prefix web`, `http://localhost:5173/opspilot/`, porta `3000`, `https://<owner>.github.io/<repo>/opspilot/`, `GitHub Actions`, `.github/workflows/pages.yml` e `Configurar URL da API`. Rejeitar linha que atribua `TOKEN`, `SECRET`, `PASSWORD`, `API_KEY` ou `OPENROUTER` e rejeitar `-----BEGIN` ([contracts/readme.md](contracts/readme.md))

### Implementation for User Story 3

- [X] T007 [US3] Criar `README.md` na raiz do OpsPilot se não existir. Se existir, acrescentar as seções sem apagar o restante. Três seções, como em [contracts/readme.md](contracts/readme.md): war room local (`npm run dev` na porta 3000 e `npm run dev --prefix web` em `http://localhost:5173/opspilot/`); war room publicada (`https://<owner>.github.io/<repo>/opspilot/`, origem do Pages em GitHub Actions, workflow `.github/workflows/pages.yml` na raiz do git); API (o Pages serve só a interface; a URL da API é a engrenagem `Configurar URL da API`; o valor inicial local é `http://localhost:3000`). Sem token, senha, conteúdo de `.env` ou pedido para commitar segredo. Não criar README na raiz do git

**Checkpoint**: US3 — o README sozinho responde a URL, o Pages e a engrenagem

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: O gate da spec, sem publicar no GitHub.

- [X] T008 Rodar `npm run typecheck` e `npm run test` na raiz do OpsPilot, como em [quickstart.md](quickstart.md). Os dois terminam com exit 0. O ensaio manual de push em `main` fica de fora

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: começa agora. O script `build` destrava o caso de build da US2
- **Foundational (Phase 2)**: sem tarefa. O lockfile e o `base` local já existem e não se mexem
- **User Stories (Phase 3+)**: US1 depois do Setup. US2 depois do teste da US1 no mesmo arquivo. US3 depois da US2, ainda em `web/src/pages-publish.test.ts`
- **Polish (Phase 6)**: depois das três histórias

### User Story Dependencies

- **User Story 1 (P1)**: depois do Setup. Não depende de US2 nem de US3
- **User Story 2 (P1)**: o build local não precisa do GitHub. O caso vive no mesmo arquivo do teste da US1, então entra depois de T002. Os passos de `--base` e `_site/opspilot/` estão no YAML de T003
- **User Story 3 (P2)**: README independente do workflow. O caso entra no mesmo teste, depois de T004

### Within Each User Story

- O teste falha antes do arquivo que ele cobre (workflow em T002→T003, README em T006→T007)
- O caso de build (T004) usa o script de T001 e pode passar assim que o Vite gerar o `index.html`
- Não há modelo nem endpoint novo

### Parallel Opportunities

- Nenhuma tarefa leva `[P]`. O teste único e o workflow único são editados em sequência
- `README.md` e `pages.yml` são arquivos distintos, mas o caso de README só é escrito em T006, depois do workflow

---

## Parallel Example: User Story 1

```bash
# Sem paralelismo: o teste e o YAML são um arquivo cada, em ordem.
Task: "T002 workflow em web/src/pages-publish.test.ts"
Task: "T003 pages.yml na raiz do git"
```

---

## Implementation Strategy

### MVP First (User Story 1 e User Story 2)

1. Phase 1: script `build`
2. Phase 3: US1 — teste do YAML e `pages.yml`
3. Phase 4: US2 — build com `/exemplo/opspilot/` e `base` local intacto
4. **STOP**: `npm test --prefix web -- src/pages-publish.test.ts` verde para o workflow e para o `index.html`. As duas histórias são P1; a sala no ar com a base errada abre em branco
5. US3 (README) e depois o polish

### Incremental Delivery

1. Setup → `vite build` disponível
2. US1 → workflow publicável no texto
3. US2 → assets sob `/opspilot/` no build de exemplo
4. US3 → README com URL, GitHub Actions e engrenagem
5. Polish → `npm run typecheck` e `npm run test` verdes

### Parallel Team Strategy

1. Uma pessoa: T001, depois T002→T003, T004→T005, T006→T007, T008
2. Não dividir o mesmo `web/src/pages-publish.test.ts` entre duas pessoas ao mesmo tempo

---

## Notes

- [P] não se aplica nesta feature: um teste, um workflow, um README, em ordem
- O Actions ignora workflow dentro do OpsPilot. O YAML fica na raiz do git
- A base local `/opspilot/` não muda. `/<repo>/opspilot/` só entra no `--base` do workflow e no teste
- `_site` e `dist` não entram no git
- Commit após cada tarefa ou grupo lógico; marcar `[x]` em `tasks.md` na implementação
- Não publicar no GitHub nesta lista. Ligar a origem "GitHub Actions" no Pages é passo manual, só documentado no README
