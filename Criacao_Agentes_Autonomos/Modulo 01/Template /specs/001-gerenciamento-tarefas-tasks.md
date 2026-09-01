# Tasks - Feature 001 (Gerenciamento de Tarefas via HTTP e CLI)

1. -[X] Fechar decisões humanas pendentes da feature
- Dependências: nenhuma.
- Pronto quando: decisões sobre política de título (normalização/rejeição), limites de tamanho, formato de resposta de remoção e saída de listagem vazia na CLI estiverem registradas e aprovadas.

2. -[X] Definir modelos de domínio e schemas Zod da feature
- Dependências: tarefa 1.
- Pronto quando: tipos `Task`, `TaskStatus`, `TaskFilter` e schemas de criação, filtro e id estiverem definidos e validados por typecheck sem erros.

3. -[X] Definir erros de domínio e contrato de tradução de erros
- Dependências: tarefa 2.
- Pronto quando: erros previsíveis (ex.: tarefa inexistente) estiverem modelados como erros de domínio e mapeamento esperado para HTTP e CLI estiver documentado nos testes.

4. -[X] Implementar store in-memory de tarefas
- Dependências: tarefas 2 e 3.
- Pronto quando: store suportar criar, listar por filtro, buscar por id, concluir e remover, preservando ordem de criação e id incremental, com testes de store passando.

5. -[X] Implementar service com regras de negócio de tarefas
- Dependências: tarefa 4.
- Pronto quando: service aplicar status inicial `open`, filtro padrão `all`, conclusão idempotente e erros de domínio para inexistentes, com testes de service passando.

6. -[X] Expor contratos HTTP da feature com validação Zod
- Dependências: tarefa 5.
- Pronto quando: rotas `POST /tasks`, `GET /tasks`, `PATCH /tasks/:id/complete` e `DELETE /tasks/:id` estiverem operacionais, validando entradas e traduzindo erros de domínio, com testes HTTP de sucesso e falha passando.

7. -[X] Expor comandos CLI da feature com validação Zod
- Dependências: tarefa 5.
- Pronto quando: comandos `tasks create`, `tasks list`, `tasks complete` e `tasks remove` estiverem operacionais, com mensagens de erro compreensíveis e código de saída não zero em falhas, validados por testes CLI.

8. -[X] Garantir consistência comportamental entre HTTP e CLI
- Dependências: tarefas 6 e 7.
- Pronto quando: casos equivalentes de criar, listar, concluir e remover tiverem resultados consistentes entre os dois canais, cobertos por testes de integração focados em comportamento.

9. -[X] Validar suíte final de qualidade da feature
- Dependências: tarefas 6, 7 e 8.
- Pronto quando: `npm run typecheck` e `npm run test` estiverem verdes e sem violação das camadas `http/cli -> service -> store`.
