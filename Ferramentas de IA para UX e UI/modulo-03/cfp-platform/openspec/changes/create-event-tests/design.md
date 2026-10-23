# Design

## Context

O projeto é um monorepo Nx contendo a aplicação Angular (`frontend`), a API NestJS (`api`) e um projeto de testes E2E (`frontend-e2e`). O `package.json` já conta com `cypress` (^16.0.0) e `@nx/cypress` instalados.
Com a integração da funcionalidade de Cadastro de Eventos (`/event/new`, implementada por `EventFormComponent`), a demanda requer testes E2E tradicionais em Cypress para validar tanto o fluxo de sucesso quanto o de erro por validação nativa.
Veja `proposal.md` para motivação e escopo.

## Goals / Non-Goals

**Goals:**
- Configurar o ambiente do Cypress no projeto `frontend-e2e`, definindo `cypress.config.ts` com `baseUrl` apontando para o servidor frontend (`http://localhost:4200`).
- Criar e manter a suíte de testes em `frontend-e2e/src/e2e/event-registration.cy.ts` (e garantir compatibilidade com `apps/frontend-e2e/src/e2e/event-registration.cy.ts`).
- Implementar o Cenário de Sucesso cobrindo:
  - Navegação para `/event/new`.
  - Preenchimento dos campos obrigatórios: Nome (`input#nome`), Endereço (`input#endereco`), Capacidade (`input#capacidade`) e Data (`input#data`) utilizando seletores CSS convencionais (`id`, `name`).
  - Submissão do formulário e verificação de sucesso na tela (`.alert-success` e identificador do evento retornado).
- Implementar o Cenário de Erro cobrindo:
  - Navegação para `/event/new`.
  - Submissão do formulário vazio diretamente no botão de envio.
  - Asserções que validam a exibição e visibilidade das mensagens nativas de validação para todos os campos obrigatórios (`#nome-error`, `#endereco-error`, `#capacidade-error`, `#data-error`).
- Utilizar exclusivamente a API tradicional e nativa do Cypress (`cy.visit`, `cy.get`, `cy.contains`, `should`).

**Non-Goals:**
- Não utilizar bibliotecas, plugins ou extensões de IA para Cypress.
- Não alterar os contratos dos endpoints existentes de eventos no backend NestJS.

## Decisions

### 1. Localização do Arquivo de Teste e Estrutura Nx
- **Decisão**: Criar o teste em `frontend-e2e/src/e2e/event-registration.cy.ts` e manter espelhamento em `apps/frontend-e2e/src/e2e/event-registration.cy.ts`.

### 2. Configuração do Cypress
- **Decisão**: Manter `cypress.config.ts` em `frontend-e2e` configurado com `specPattern: '**/*.cy.ts'`, suporte a TypeScript e `baseUrl: 'http://localhost:4200'`.

### 3. Seletores CSS Convencionais e Resiliência
- **Decisão**: Utilizar seletores CSS padrão como `#nome, [name="nome"]`, `#endereco, [name="endereco"]`, `#capacidade, [name="capacidade"]`, `#data, [name="data"]`, e `button[type="submit"]`.

### 4. Asserções Tradicionais do Cypress
- **Decisão**: Utilizar encadeamentos nativos do Cypress como `.should('be.visible')`, `.should('have.value', ...)`, `.should('contain', ...)` e `cy.contains(...)`.

## Risks / Trade-offs

- **[Risco] Backend da API indisponível ou com estado dinâmico durante testes E2E**
  - *Mitigação*: Utilizar `cy.intercept('POST', '**/api/events*')` nativo do Cypress para isolar o frontend e garantir testes rápidos, confiáveis e determinísticos.
