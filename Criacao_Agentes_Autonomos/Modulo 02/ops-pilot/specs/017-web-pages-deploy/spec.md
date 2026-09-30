# Feature Specification: Deploy da war room no Pages

**Feature Branch**: `017-web-pages-deploy`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "Deploy do web/ no Pages via Actions: upload-pages-artifact + deploy-pages, permissions, README (atualizar)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publicar a war room com as actions de Pages (Priority: P1)

Quem mantém o OpsPilot envia a war room para o GitHub Pages por um workflow. O workflow só lê o repositório, publica a página e autentica a publicação com o token do próprio GitHub. A subida do artefato usa `actions/upload-pages-artifact` e a publicação usa `actions/deploy-pages`.

**Why this priority**: Sem esse pipeline a sala existe só na máquina de quem desenvolve. As permissões e as duas actions são o contrato de publicação que o pedido fixa.

**Independent Test**: Ler o workflow e conferir o gatilho, o bloco de permissões e as duas actions. Um build de produção da sala, com a base de Pages, gera `index.html` sem subir nada ao GitHub.

**Acceptance Scenarios**:

1. **Given** o workflow de Pages no repositório, **When** alguém lê as permissões do token do workflow, **Then** elas são exatamente `contents: read`, `pages: write` e `id-token: write`.
2. **Given** um push na branch `main` que o workflow observa, ou um disparo manual, **When** o build da sala termina com sucesso, **Then** o job envia o artefato com `actions/upload-pages-artifact` e publica com `actions/deploy-pages`.
3. **Given** o build da sala falha, **When** o workflow segue, **Then** `actions/deploy-pages` não publica essa execução.
4. **Given** duas publicações disparadas juntas, **When** a primeira ainda está no ar, **Then** a segunda espera; a publicação em andamento não é cancelada.

---

### User Story 2 - A sala publicada abre em /opspilot/ (Priority: P1)

O plantonista abre a URL do Pages e encontra a war room no caminho que termina em `/opspilot/`. Os scripts e estilos carregam nesse prefixo, não na raiz do host. Na máquina local, o Vite continua com a base `/opspilot/`.

**Why this priority**: Um artefato no ar com o caminho errado mostra uma página em branco. A base `/opspilot/` já é o contrato da sala.

**Independent Test**: Gerar o build de produção com a base `/<repositório>/opspilot/` e conferir que o `index.html` aponta recursos sob um caminho que contém `/opspilot/`. O `base` gravado em `web/vite.config.ts` permanece `/opspilot/`.

**Acceptance Scenarios**:

1. **Given** uma publicação bem-sucedida do repositório `<owner>/<repo>`, **When** o plantonista abre `https://<owner>.github.io/<repo>/opspilot/`, **Then** a war room aparece com o título da sala.
2. **Given** o `index.html` desse build, **When** se leem os endereços de script e de estilo, **Then** cada um contém o segmento `/opspilot/`.
3. **Given** o arquivo `web/vite.config.ts` depois desta feature, **When** se lê o `base` de desenvolvimento, **Then** ele continua `/opspilot/`.
4. **Given** a raiz do site Pages (`https://<owner>.github.io/<repo>/`), **When** alguém a abre, **Then** esta feature não promete redirecionar para a sala.

---

### User Story 3 - O README explica a sala local e a publicada (Priority: P2)

Quem chega ao OpsPilot lê o README na raiz do projeto e descobre como subir a sala na máquina, qual é a URL publicada e que a API não vai junto com o Pages. A URL da API continua sendo a da engrenagem.

**Why this priority**: O pipeline sozinho não diz a ninguém o endereço nem o fato de o Pages ser só a interface. O README é o que o pedido pede para atualizar.

**Independent Test**: Abrir o `README.md` na raiz do OpsPilot (o diretório de `web/` e do `package.json`) e achar, sem abrir o workflow, o comando local, a forma da URL do Pages e a frase de que a API se configura na engrenagem.

**Acceptance Scenarios**:

1. **Given** o README do OpsPilot, **When** alguém procura a sala publicada, **Then** encontra o formato `https://<owner>.github.io/<repo>/opspilot/` e a orientação de deixar a origem do Pages em GitHub Actions.
2. **Given** o mesmo README, **When** alguém procura como rodar na máquina, **Then** encontra como subir a API e a sala em `/opspilot/`, e que a engrenagem guarda a URL da API porque o Pages não hospeda a API.
3. **Given** o README, **When** se procura segredo, token ou conteúdo de `.env`, **Then** não há nenhum.
4. **Given** um README que ainda não existia, **When** esta feature termina, **Then** o arquivo passa a existir com esse conteúdo. Um README que já existia é atualizado, não apagado.

---

### Edge Cases

- Push em branch que não é `main` não publica. O disparo manual (`workflow_dispatch`) publica a ref escolhida.
- O nome do repositório entra na base de produção em minúsculas, para o caminho do Pages bater com o que o GitHub serve.
- Falha de instalação ou de build interrompe antes do `deploy-pages`.
- O artefato não inclui `node_modules`, `.env`, `.env.*` nem o código da API.
- Duas execuções concorrentes compartilham o grupo `pages` e a que já está publicando segue até o fim.
- Repositório sem a origem "GitHub Actions" ligada nas configurações de Pages: o README avisa; o workflow não altera essa configuração da conta.
- O workflow não cria ambiente, segredo nem variável nova no GitHub além do ambiente `github-pages` exigido pela publicação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O repositório MUST ter um workflow em `.github/workflows/pages.yml` que rode no push para `main` e em `workflow_dispatch`.
- **FR-002**: O token desse workflow MUST ter somente `contents: read`, `pages: write` e `id-token: write`.
- **FR-003**: Depois de um build bem-sucedido de `web/`, o workflow MUST enviar o artefato com `actions/upload-pages-artifact` e publicar com `actions/deploy-pages`, no ambiente `github-pages`. `actions/configure-pages` MAY rodar antes do upload e MUST NOT substituir essas duas actions.
- **FR-004**: O build de publicação MUST usar Node.js 22, instalar `web/` a partir do lockfile e gerar o site com base `/<repositório-em-minúsculas>/opspilot/`. O artefato MUST colocar a sala de forma que a URL pública termine em `/opspilot/`.
- **FR-005**: `web/vite.config.ts` MUST manter `base` `/opspilot/` para o desenvolvimento local.
- **FR-006**: O workflow MUST usar o grupo de concorrência `pages` com `cancel-in-progress: false`. Build que falha MUST NOT chamar `deploy-pages`.
- **FR-007**: O artefato MUST ser só o estático da sala. MUST NOT incluir a API, `node_modules`, `.env` nem `.env.*`.
- **FR-008**: `README.md` na raiz do OpsPilot MUST documentar: subir API e sala no caminho `/opspilot/`; a URL `https://<owner>.github.io/<repo>/opspilot/`; origem do Pages em GitHub Actions; engrenagem como lugar da URL da API. MUST NOT incluir segredo. Conteúdo anterior do README, se houver, MUST permanecer.
- **FR-009**: Uma verificação automática, sem publicar no GitHub, MUST confirmar que `pages.yml` declara as três permissões e as actions `upload-pages-artifact` e `deploy-pages`, e que um build com a base de produção escreve um `index.html` cujos scripts e estilos contêm `/opspilot/`. `npm run typecheck` e `npm run test` MUST permanecer verdes.

### Key Entities

- **Workflow de Pages**: o pipeline que observa `main` e o disparo manual, limita o token, constrói `web/` e publica o artefato.
- **Artefato da sala**: o diretório estático enviado ao Pages, com a sala alcançável em `/opspilot/` dentro do site do repositório.
- **README do OpsPilot**: o documento na raiz do projeto que explica a sala local e a URL publicada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das execuções de teste do workflow como texto, as permissões são as três de FR-002 e as actions nomeadas em FR-003 aparecem.
- **SC-002**: Em 100% dos builds de produção do teste, todo script e todo estilo do `index.html` contém `/opspilot/`, e o `base` de `web/vite.config.ts` continua `/opspilot/`.
- **SC-003**: Depois de uma publicação bem-sucedida, a war room abre na URL que termina em `/opspilot/` sem pedir outro deploy manual além do próprio workflow.
- **SC-004**: Uma pessoa que lê só o README encontra a URL publicada, o passo de ligar GitHub Actions no Pages e o papel da engrenagem em menos de 3 minutos.

## Assumptions

- A branch de publicação automática é `main`. A branch de trabalho atual (`feature/modulo-01`) não dispara o deploy até o merge, salvo `workflow_dispatch`.
- O site é o GitHub Pages de projeto: `https://<owner>.github.io/<repo>/`. O repositório remoto conhecido é `engenharia-ia-aplicada`; o workflow deriva o nome em minúsculas em tempo de execução, sem gravar o nome no Vite de desenvolvimento.
- A base local `/opspilot/` da feature 016 não muda. Só o build do workflow usa `/<repo>/opspilot/`, e o artefato é organizado para esse caminho.
- `actions/configure-pages` entra como passo de preparação. As actions obrigatórias continuam sendo `upload-pages-artifact` e `deploy-pages`.
- Não há README na raiz do OpsPilot hoje. Criar `README.md` com as seções de FR-008 cumpre "atualizar". Se o arquivo existir na implementação, a seção entra sem apagar o resto.
- O Pages não hospeda a API nem o banco. CORS e a engrenagem da feature 016 seguem valendo para o navegador que abre a URL publicada.
- Ligar "GitHub Actions" como origem do Pages é um passo único na configuração do repositório, descrito no README, fora do YAML.
- Pull requests não geram preview. Não há domínio customizado nesta feature.
