# Tasks - Feature 002 (Persistência de Tarefas em JSON entre Sessões)

1. -[X] Fechar decisões pendentes de backup e comunicação
- Dependências: nenhuma.
- Pronto quando: padrão de nome de backup, política de retenção e formato de mensagem de recuperação por canal (CLI/HTTP) estiverem definidos e registrados na spec/plano.

2. -[X] Definir modelo persistido e schemas Zod de armazenamento
- Dependências: tarefa 1.
- Pronto quando: estrutura persistida (`nextId` e `tasks`) estiver formalizada em tipos/schemas, com testes de validação de shape válido e inválido passando.

3. -[X] Implementar utilitários de IO para `.data/tasks.json`
- Dependências: tarefa 2.
- Pronto quando: leitura/escrita do arquivo, criação automática de diretório/arquivo ausente e serialização consistente estiverem implementadas com testes unitários de IO passando.

4. -[X] Implementar recuperação de corrupção com backup + reset
- Dependências: tarefas 2 e 3.
- Pronto quando: arquivo JSON inválido gerar backup conforme convenção definida e reinicialização para estado vazio válido, com testes cobrindo fluxo completo de recuperação.

5. -[X] Criar store persistente em arquivo mantendo contrato atual
- Dependências: tarefas 2, 3 e 4.
- Pronto quando: store suportar criar, listar, concluir e remover com persistência entre instâncias, preservando `nextId` e ordem de criação, com testes da store passando.

6. -[X] Integrar persistência no HTTP usando a nova store
- Dependências: tarefa 5.
- Pronto quando: API HTTP usar `.data/tasks.json` como fonte de estado, mantendo os mesmos contratos de rota/validação e com testes HTTP de regressão passando.

7. -[X] Integrar persistência no CLI usando a nova store
- Dependências: tarefa 5.
- Pronto quando: CLI usar `.data/tasks.json` como fonte de estado, preservando comandos e mensagens existentes, com testes de CLI entre execuções passando.

8. -[X] Garantir consistência de estado entre HTTP e CLI persistentes
- Dependências: tarefas 6 e 7.
- Pronto quando: cenários cruzados (criar em um canal e listar/concluir/remover no outro) passarem em testes de integração com o mesmo arquivo persistido.

9. -[X] Implementar comunicação de recuperação por corrupção nos canais
- Dependências: tarefas 4, 6 e 7.
- Pronto quando: mensagens de recuperação estiverem emitidas conforme decisão definida para CLI/HTTP, com testes validando conteúdo e canal.

10. -[X] Validar suíte final da feature 002
- Dependências: tarefas 6, 7, 8 e 9.
- Pronto quando: `npm run test` e `npm run typecheck` estiverem verdes, sem violação de camadas (`http/cli -> service -> store`) e com cobertura dos cenários críticos de persistência.
