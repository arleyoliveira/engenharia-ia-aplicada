# Spec Delta

## Purpose

Define a especificação de testes End-to-End (E2E) com Cypress para o formulário de cadastro de eventos na rota `/event/new`, assegurando a validação dos cenários de sucesso e exibição de erros nativos com seletores CSS convencionais.

## ADDED Requirements

### Requirement: Submissão de evento com dados válidos
A suíte de testes E2E SHALL validar que a navegação para `/event/new`, o preenchimento de todos os campos obrigatórios (Nome, Endereço, Capacidade e Data) com seletores CSS convencionais e o clique no botão de submissão resultam em confirmação visível de sucesso e exibição do identificador do evento.

#### Scenario: Cadastro de evento realizado com sucesso
- **WHEN** o teste Cypress navega para `/event/new`, preenche os campos nome, endereço, capacidade e data usando seletores CSS convencionais (`id`, `class` ou `name`) e aciona o botão de submeter
- **THEN** a aplicação confirma o envio bem-sucedido e exibe indicador ou mensagem de sucesso visível na tela com o id gerado

### Requirement: Validação de campos obrigatórios no formulário de evento
A suíte de testes E2E SHALL validar que a tentativa de submissão do formulário de evento com campos vazios impede o cadastro e exibe mensagens de erro nativas de validação na interface.

#### Scenario: Submissão com campos vazios exibe mensagens de erro
- **WHEN** o teste Cypress navega para `/event/new` e aciona o botão de submissão sem preencher os campos do formulário
- **THEN** a tela exibe asserções visíveis confirmando as mensagens nativas de validação para os campos obrigatórios (`#nome-error`, `#endereco-error`, `#capacidade-error`, `#data-error`) e não realiza o cadastro

### Requirement: Conformidade com sintaxe tradicional do Cypress
Os testes automatizados E2E SHALL utilizar exclusivamente a sintaxe nativa e tradicional do Cypress (`cy.get`, `cy.contains`, `should`), sem inclusão de bibliotecas ou serviços externos baseados em inteligência artificial.

#### Scenario: Estrutura dos testes sem dependências de IA
- **WHEN** os testes em `event-registration.cy.ts` são executados pelo Cypress
- **THEN** todas as ações e asserções utilizam comandos nativos encadeados (`cy.get`, `cy.contains`, `.should`) e seletores CSS padrão
