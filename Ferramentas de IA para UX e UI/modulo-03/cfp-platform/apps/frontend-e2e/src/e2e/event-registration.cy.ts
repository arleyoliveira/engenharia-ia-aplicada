describe('Cadastro de Evento (/event/new)', () => {
  beforeEach(() => {
    // Interceptar a API de eventos para garantir testes determinísticos e isolados
    cy.intercept('POST', '**/api/events*', {
      statusCode: 201,
      body: {
        id: 'event-12345',
        nome: 'Auditório Oracle',
        endereco: 'Rua Olibrio Lima, Januária, MG',
        capacidade: 1000,
        data: '2026-12-31',
      },
    }).as('createEvent');

    cy.visit('/event/new');
  });

  it('deve realizar o cadastro do evento com sucesso ao preencher todos os campos obrigatórios', () => {
    // Preenchimento dos campos obrigatórios com seletores CSS convencionais (id, name)
    cy.get('input#nome, input[name="nome"]')
      .should('be.visible')
      .clear()
      .type('Auditório Oracle')
      .should('have.value', 'Auditório Oracle');

    cy.get('input#endereco, input[name="endereco"]')
      .should('be.visible')
      .clear()
      .type('Rua Olibrio Lima, Januária, MG')
      .should('have.value', 'Rua Olibrio Lima, Januária, MG');

    cy.get('input#capacidade, input[name="capacidade"]')
      .should('be.visible')
      .clear()
      .type('1000')
      .should('have.value', '1000');

    cy.get('input#data, input[name="data"]')
      .should('be.visible')
      .clear()
      .type('2026-12-31')
      .should('have.value', '2026-12-31');

    // Acionamento do botão de submissão
    cy.get('button[type="submit"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();

    // Aguardar interceptação da chamada da API
    cy.wait('@createEvent');

    // Verificação de sucesso na interface via asserções nativas Cypress
    cy.get('.alert-success')
      .should('be.visible')
      .and('contain', 'Sucesso!')
      .and('contain', 'O local do evento foi cadastrado com sucesso!');

    cy.contains('event-12345').should('be.visible');
  });

  it('deve exibir mensagens nativas de erro de validação ao submeter formulário vazio', () => {
    // Tentativa de submissão do formulário vazio
    cy.get('button[type="submit"]')
      .should('be.visible')
      .click();

    // Verificação das mensagens nativas de erro de validação para todos os campos obrigatórios
    cy.get('#nome-error, .error-text')
      .should('be.visible')
      .and('contain', 'O nome do evento é obrigatório.');

    cy.get('#endereco-error, .error-text')
      .should('be.visible')
      .and('contain', 'O endereço é obrigatório.');

    cy.get('#capacidade-error, .error-text')
      .should('be.visible')
      .and('contain', 'A capacidade é obrigatória e deve ser maior que zero.');

    cy.get('#data-error, .error-text')
      .should('be.visible')
      .and('contain', 'A data do evento é obrigatória.');

    // Verificação de que as classes de erro foram aplicadas aos grupos do formulário
    cy.get('.form-group.has-error').should('have.length', 4);
  });
});
