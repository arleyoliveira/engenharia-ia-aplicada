# Tasks

## 1. Configuração do Cypress em frontend-e2e

- [x] 1.1 Configurar o arquivo `frontend-e2e/cypress.config.ts` com `baseUrl: 'http://localhost:4200'` e suporte a testes TypeScript no padrão `**/*.cy.ts`, verificando a integridade da configuração.
- [x] 1.2 Ajustar `frontend-e2e/tsconfig.json` para incluir tipagens do Cypress (`cypress`), verificando a compilação via `npx tsc -p frontend-e2e/tsconfig.json --noEmit`.

## 2. Implementação dos Testes E2E de Cadastro de Propostas CFP

- [x] 2.1 Criar o arquivo `frontend-e2e/src/e2e/event-registration.cy.ts` implementando o Cenário de Sucesso (visita a `/`, preenchimento de Nome, E-mail, Título e GDE com seletores CSS convencionais e submissão validada por asserções nativas Cypress), verificando a correta escrita do arquivo.
- [x] 2.2 Implementar o Cenário de Erro no mesmo arquivo (visita a `/`, validação de botão desabilitado e asserções com `cy.get().should('be.visible')` para mensagens nativas de erro), verificando a cobertura dos cenários.
- [x] 2.3 Garantir compatibilidade de localização criando diretório ou apontamento em `apps/frontend-e2e/src/e2e/event-registration.cy.ts`, verificando que o arquivo é acessível no caminho solicitado.

## 3. Validação e Qualidade dos Testes

- [x] 3.1 Validar a aderência às regras do Cypress tradicional (ausência de bibliotecas externas de IA e uso exclusivo de `cy.get`, `cy.contains`, `should`) e executar linting através de `npx nx lint frontend-e2e`.
- [x] 3.2 Executar verificação de tipagem completa no projeto de testes via `npx tsc -p frontend-e2e/tsconfig.json --noEmit`, confirmando ausência de erros.

## Workflow follow-up

- Iniciar a implementação executando `/opsx-apply`.
- Executar os testes Cypress e sincronizar as especificações com `/opsx-sync` ou `/opsx-archive`.
