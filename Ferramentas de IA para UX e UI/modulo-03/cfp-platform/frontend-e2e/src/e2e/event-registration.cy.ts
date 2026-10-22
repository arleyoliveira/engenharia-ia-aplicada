describe('Cadastro de Proposta CFP (Call for Papers)', () => {
  beforeEach(() => {
    // Interceptar a API de submissão de palestras para isolar o teste E2E
    cy.intercept('POST', '**/api/speakers*', {
      statusCode: 201,
      body: {
        id: 'speaker-12345',
        nome: 'Maria Silva',
        email: 'maria.silva@exemplo.com',
        talkTitle: 'Arquitetura Escalável com Angular Signals',
        isGDE: true,
      },
    }).as('submitSpeaker');

    cy.visit('/');
  });

  it('deve realizar o cadastro da proposta de palestra com sucesso ao preencher todos os campos obrigatórios', () => {
    // Preenchimento dos campos obrigatórios com seletores CSS convencionais (id, name)
    cy.get('input#nome, input[name="nome"]')
      .should('be.visible')
      .clear()
      .type('Maria Silva')
      .should('have.value', 'Maria Silva');

    cy.get('input#email, input[name="email"]')
      .should('be.visible')
      .clear()
      .type('maria.silva@exemplo.com')
      .should('have.value', 'maria.silva@exemplo.com');

    cy.get('input#talkTitle, input[name="talkTitle"]')
      .should('be.visible')
      .clear()
      .type('Arquitetura Escalável com Angular Signals')
      .should('have.value', 'Arquitetura Escalável com Angular Signals');

    cy.get('input#isGDE, input[name="isGDE"]')
      .should('be.visible')
      .check()
      .should('be.checked');

    // Botão de submissão habilitado e envio
    cy.get('button[type="submit"]')
      .should('be.visible')
      .should('not.be.disabled')
      .click();

    // Aguardar interceptação da chamada
    cy.wait('@submitSpeaker');

    // Verificação de sucesso na interface via asserções nativas Cypress
    cy.get('.alert-success')
      .should('be.visible')
      .and('contain', 'Sucesso!')
      .and('contain', 'Sua proposta de palestra foi enviada com sucesso!');

    cy.contains('speaker-12345').should('be.visible');
  });

  it('deve exibir mensagens nativas de erro de validação e manter botão desabilitado quando formulário estiver vazio/inválido', () => {
    // Validação de estado inicial do botão de submissão (desabilitado quando vazio)
    cy.get('button[type="submit"]')
      .should('be.visible')
      .should('be.disabled')
      .and('have.attr', 'aria-disabled', 'true');

    // Interação com os campos obrigatórios para disparar os erros nativos (blur)
    cy.get('input#nome').focus().blur();
    cy.get('#nome-error, .error-text')
      .should('be.visible')
      .and('contain', 'O nome é obrigatório.');

    cy.get('input#email').focus().type('emailinvalido').blur();
    cy.get('#email-error, .error-text')
      .should('be.visible')
      .and('contain', 'Informe um e-mail válido');

    cy.get('input#talkTitle').focus().blur();
    cy.get('#talkTitle-error, .error-text')
      .should('be.visible')
      .and('contain', 'O título da palestra é obrigatório.');

    // Verificação de que classes de erro foram aplicadas aos grupos
    cy.get('.form-group.has-error').should('have.length.at.least', 2);
  });
});
