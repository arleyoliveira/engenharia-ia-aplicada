---
mode: agent
description: Implemente as tarefas pendentes uma a uma, com testes.
---

Implemente as tarefas do tasks.md da feature indicada (texto após o comando).

Uma tarefa por vez:
1. Escolha a próxima "-[ ]" cujas dependências já estão prontas.
2. Implemente seguindo o plan.md, as instructions e a constitution.
3. Escreva/atualize testes e rode npm run test e npm run typecheck.
4. Só marque "-[X]" quando estiver verde.
5. Pare ao concluir uma fatia coesa e peça revisão.

Nunca desative testes/tipos para "passar".
Se a spec estiver errada, pare e avise.
