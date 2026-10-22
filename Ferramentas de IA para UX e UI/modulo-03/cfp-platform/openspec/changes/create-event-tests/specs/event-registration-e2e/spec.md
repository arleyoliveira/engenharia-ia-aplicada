# Spec Delta

## Purpose

Define a especificação de testes End-to-End (E2E) com Cypress para o formulário de cadastro de propostas de palestras CFP (Call for Papers) na rota `/`, assegurando a validação dos cenários de sucesso e exibição de erros nativos com seletores CSS convencionais.

## ADDED Requirements

### Requirement: Submissão de proposta CFP com dados válidos
A suíte de testes E2E SHALL validar que a navegação para `/`, o preenchimento de todos os campos obrigatórios (Nome, E-mail, Título da Palestra e GDE opcional) com seletores CSS convencionais e o clique no botão de submissão resultam em confirmação visível de sucesso e exibição do identificador da proposta.

#### Scenario: Cadastro de proposta realizado com sucesso
- **WHEN** o teste Cypress navega para `/`, preenche os campos nome, e-mail, título da palestra usando seletores CSS convencionais (`id`, `class` ou `name`), marca a opção GDE e aciona o botão de submeter
- **THEN** a aplicação confirma o envio bem-sucedido e exibe alerta de sucesso visível na tela com o id gerado

### Requirement: Validação de campos obrigatórios no formulário CFP
A suíte de testes E2E SHALL validar que o formulário de proposta CFP mantém o botão de submissão desabilitado quando vazio e exibe mensagens de erro nativas ao interagir com campos obrigatórios sem preenchimento correto.

#### Scenario: Formulário vazio/inválido exibe mensagens de erro e desabilita envio
- **WHEN** o teste Cypress navega para `/` e interage (blur) com os campos do formulário sem preenchimento válido
- **THEN** a tela exibe mensagens nativas de validação para os campos obrigatórios e mantém o botão de submissão desabilitado (`disabled` e `aria-disabled="true"`)

### Requirement: Conformidade com sintaxe tradicional do Cypress
Os testes automatizados E2E SHALL utilizar exclusivamente a sintaxe nativa e tradicional do Cypress (`cy.get`, `cy.contains`, `should`), sem inclusão de bibliotecas ou serviços externos baseados em inteligência artificial.

#### Scenario: Estrutura dos testes sem dependências de IA
- **WHEN** os testes em `event-registration.cy.ts` são executados pelo Cypress
- **THEN** todas as ações e asserções utilizam comandos nativos encadeados (`cy.get`, `cy.contains`, `.should`) e seletores CSS padrão
