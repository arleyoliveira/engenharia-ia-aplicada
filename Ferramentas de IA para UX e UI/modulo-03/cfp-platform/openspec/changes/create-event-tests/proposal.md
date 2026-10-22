# Proposal

## Why

Para garantir a confiabilidade e integridade do processo de submissão de propostas de palestras na plataforma CFP, é necessário implementar uma suíte de testes End-to-End (E2E) robusta. A automação desses testes valida o fluxo de cadastro tanto no caminho feliz (preenchimento completo e submissão bem-sucedida) quanto nos fluxos de exceção (validações nativas de campos obrigatórios e botão desabilitado), assegurando que regressões não afetem organizadores e palestrantes da plataforma.

## What Changes

- **Estruturação de Testes E2E com Cypress**:
  - Configuração do suporte e execução de testes Cypress no projeto `frontend-e2e`.
  - Criação do arquivo de teste `frontend-e2e/src/e2e/event-registration.cy.ts` (e referência `apps/frontend-e2e/src/e2e/event-registration.cy.ts`).
- **Cenário de Sucesso**:
  - Navegação automatizada até a tela principal (`/`).
  - Preenchimento dos campos obrigatórios (Nome, E-mail, Título da Palestra e GDE) utilizando seletores CSS convencionais (`id`, `name`).
  - Acionamento do botão de submissão e asserção de confirmação de sucesso com sintaxe tradicional Cypress (`cy.contains`, `.should()`).
- **Cenário de Erro**:
  - Navegação automatizada até a tela principal (`/`).
  - Verificação de botão de submissão desabilitado com formulário vazio.
  - Validação da exibição em tela de mensagens de erro nativas para os campos obrigatórios não preenchidos.
- **Diretriz de Sintaxe Tradicional**:
  - Uso exclusivo de comandos nativos do Cypress (`cy.visit()`, `cy.get()`, `cy.contains()`, `should()`), sem inclusão de bibliotecas ou extensões de terceiros baseadas em IA.

## Capabilities

### New Capabilities
- `event-registration-e2e`: Especificação de testes End-to-End (E2E) tradicionais em Cypress para a tela de Cadastro de Propostas CFP (`/`), cobrindo fluxos de sucesso e mensagens nativas de validação de erro.

### Modified Capabilities
<!-- Nenhuma alteração nas regras de capacidades existentes (cfp-submission ou cfp-dashboard). -->

## Impact

- **Testes E2E**:
  - Criação de `frontend-e2e/src/e2e/event-registration.cy.ts`.
  - Configurações do Cypress em `frontend-e2e` (`cypress.config.ts`, `tsconfig.json`).
- **Dependências**: Reutilização de pacotes já presentes no workspace (`cypress`, `@nx/cypress`).
