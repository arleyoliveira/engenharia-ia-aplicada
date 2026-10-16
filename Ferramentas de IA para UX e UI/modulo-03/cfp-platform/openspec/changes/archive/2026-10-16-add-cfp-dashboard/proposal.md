# Proposal

## Why

Atualmente, a plataforma CFP permite a submissão de palestras, mas organizadores e participantes não possuem uma interface para visualizar, consultar e acompanhar as palestras já submetidas. A criação de um Dashboard resolve esse problema, expondo uma visualização clara das propostas enviadas e integrando a navegação na plataforma de forma consistente.

## What Changes

- **Backend (NestJS)**: Garantir/adicionar endpoint GET no controller de CFP (`/api/speakers` ou alias `CfpController`) retornando a lista de submissões (`SpeakerDTO[]`).
- **Frontend (Angular 21)**:
  - Criação do componente `CfpDashboardComponent` com gerenciamento de estado reativo via Signals (`WritableSignal<SpeakerDTO[]>`).
  - Consumo da rota GET injetando `HttpClient` (ou serviço Angular correspondente `CfpService`).
  - Layout e interface com HTML semântico (tabela acessível ou lista de cards), mantendo rigorosamente os Design Tokens, cores e tipografia estabelecidos no `CfpFormComponent`.
  - Configuração do roteamento Angular (`app.routes.ts`) adicionando a rota `path: 'dashboard'` apontando para o `CfpDashboardComponent`.
  - Adição de botão/link de navegação no formulário original (`CfpFormComponent`) preservando a identidade visual.

## Capabilities

### New Capabilities
- `cfp-dashboard`: Visualização e listagem das palestras submetidas com gerenciamento de estado por Signals, rota dedicada (`/dashboard`) e consistência visual estrita com o design system do CFP.

### Modified Capabilities
<!-- Nenhuma alteração nas regras de validação ou contratos de submissão do spec existente cfp-submission. -->

## Impact

- **Backend**: `api/src/app/speakers/speakers.controller.ts` (ou `cfp.controller.ts`) e `speakers.service.ts`.
- **Frontend**:
  - `frontend/src/app/components/cfp-dashboard/` (novo componente standalone).
  - `frontend/src/app/services/cfp.service.ts` (método para buscar palestras submetidas).
  - `frontend/src/app/app.routes.ts` e `frontend/src/app/app.html` (roteamento e exibição de rotas via `<router-outlet>`).
  - `frontend/src/app/components/cfp-form/` (botão de navegação para o dashboard).
- **Tipagens compartilhadas**: Reutilização de `SpeakerDTO` de `@cfp-platform/shared-types`.
