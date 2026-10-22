# Design

## Context

O projeto é um monorepo Nx contendo a aplicação Angular (`frontend`), a API NestJS (`api`) e um projeto de testes E2E (`frontend-e2e`). O `package.json` já conta com `cypress` (^16.0.0) e `@nx/cypress` instalados.
A demanda requer a criação de testes E2E tradicionais em Cypress para a tela de Cadastro de Propostas CFP (`/`), sem uso de bibliotecas de IA.
Veja `proposal.md` para motivação e escopo.

## Goals / Non-Goals

**Goals:**
- Configurar o ambiente do Cypress no projeto `frontend-e2e`, definindo `cypress.config.ts` com `baseUrl` apontando para o servidor frontend (`http://localhost:4200`).
- Criar a suíte de testes em `frontend-e2e/src/e2e/event-registration.cy.ts` (e garantir compatibilidade com `apps/frontend-e2e/src/e2e/event-registration.cy.ts`).
- Implementar o Cenário de Sucesso cobrindo:
  - Navegação para `/`.
  - Preenchimento dos campos: Nome, E-mail, Título da Palestra e GDE utilizando seletores CSS convencionais (`id`, `name`).
  - Submissão do formulário e verificação de sucesso na tela (`.alert-success`).
- Implementar o Cenário de Erro cobrindo:
  - Navegação para `/`.
  - Verificação de estado inicial desabilitado do botão de envio.
  - Asserções que validam a presença e visibilidade das mensagens nativas de validação dos campos obrigatórios após blur/interação.
- Utilizar exclusivamente a API clássica do Cypress (`cy.visit`, `cy.get`, `cy.contains`, `should`).

**Non-Goals:**
- Não utilizar bibliotecas, plugins ou extensões de IA (como geradores automáticos de seletores ou asserções com LLM).
- Não refatorar ou modificar as regras de negócio dos endpoints existentes de CFP no backend.

## Decisions

### 1. Localização do Arquivo de Teste e Estrutura Nx
- **Decisão**: Criar o teste em `frontend-e2e/src/e2e/event-registration.cy.ts`. Adicionalmente, garantir espelhamento em `apps/frontend-e2e/src/e2e/event-registration.cy.ts`.

### 2. Configuração do Cypress
- **Decisão**: Criar `cypress.config.ts` em `frontend-e2e` configurando o `specPattern: '**/*.cy.ts'`, suporte a TypeScript e `baseUrl: 'http://localhost:4200'`.

### 3. Seletores CSS Convencionais e Resiliência
- **Decisão**: Utilizar seletores CSS padrão como `#nome, [name="nome"]`, `#email, [name="email"]`, `#talkTitle, [name="talkTitle"]`, `#isGDE, [name="isGDE"]`, e `button[type="submit"]`.

### 4. Asserções Tradicionais do Cypress
- **Decisão**: Utilizar encadeamentos nativos do Cypress como `.should('be.visible')`, `.should('have.value', ...)`, `.should('be.disabled')` e `cy.contains(...)`.

## Risks / Trade-offs

- **[Risco] Backend da API indisponível no momento dos testes E2E**
  - *Mitigação*: Utilizar `cy.intercept('POST', '**/api/speakers*')` nativo do Cypress para isolar o frontend e garantir testes determinísticos e rápidos.
