# Proposal

## Why

Para garantir a confiabilidade e integridade do processo de cadastro de locais de eventos na plataforma CFP, é necessário implementar uma suíte de testes End-to-End (E2E) robusta. A automação desses testes valida o fluxo de cadastro na rota `/event/new` tanto no caminho feliz (preenchimento completo de nome, endereço, capacidade e data com submissão bem-sucedida) quanto no fluxo de exceção (submissão com campos vazios e exibição de mensagens nativas de validação), assegurando que regressões não afetem a criação de eventos no sistema.

## What Changes

- **Estruturação de Testes E2E com Cypress**:
  - Configuração do suporte e execução de testes Cypress no projeto `frontend-e2e`.
  - Atualização do arquivo de teste `frontend-e2e/src/e2e/event-registration.cy.ts` (e compatibilidade com `apps/frontend-e2e/src/e2e/event-registration.cy.ts`).
- **Cenário de Sucesso**:
  - Navegação automatizada até a tela de cadastro de eventos (`/event/new`).
  - Preenchimento dos campos obrigatórios (Nome, Endereço, Capacidade e Data) utilizando seletores CSS convencionais (`id`, `name`).
  - Acionamento do botão de submissão e asserção de confirmação de sucesso com sintaxe tradicional Cypress (`cy.contains`, `.should()`), validando alerta e identificador do evento.
- **Cenário de Erro**:
  - Navegação automatizada até a tela de cadastro de eventos (`/event/new`).
  - Submissão do formulário vazio diretamente pelo botão de cadastro.
  - Validação da exibição em tela de mensagens de erro nativas para todos os campos obrigatórios (`#nome-error`, `#endereco-error`, `#capacidade-error`, `#data-error`) e classes `.has-error`.
- **Diretriz de Sintaxe Tradicional**:
  - Uso exclusivo de comandos nativos do Cypress (`cy.visit()`, `cy.get()`, `cy.contains()`, `should()`), sem inclusão de bibliotecas ou serviços externos de IA.

## Capabilities

### New Capabilities
- `event-registration-e2e`: Especificação de testes End-to-End (E2E) tradicionais em Cypress para a tela de Cadastro de Evento (`/event/new`), cobrindo cenários de sucesso e mensagens nativas de erro de validação.

### Modified Capabilities
<!-- Nenhuma alteração nas regras de capacidades existentes (cfp-submission ou cfp-dashboard). -->

## Impact

- **Testes E2E**:
  - Arquivo `frontend-e2e/src/e2e/event-registration.cy.ts` e espelho em `apps/frontend-e2e/src/e2e/event-registration.cy.ts`.
  - Configurações do Cypress em `frontend-e2e` (`cypress.config.ts`, `tsconfig.json`).
- **Dependências**: Reutilização de pacotes já presentes no workspace (`cypress`, `@nx/cypress`).
