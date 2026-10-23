describe('Cadastro de Eventos - AI Driven Testing', () => {
    it('Deve executar o fluxo de cadastro e validar o sucesso de forma semântica', () => {
        cy.visit('/event/new')

        cy.prompt([
            'Type "Auditória Oracle" in the event name field',
            'Type "Rua Olibrio Lima, Januária, MG" in the addreess field',
            'Type "1000" in the capacity field',
            'Type "2026-12-31" in the start date field',
            'Click the buttom that submits or save the event'
        ])

        cy.prompt([
            'Verify that a success message is visible'
        ])

    })
})