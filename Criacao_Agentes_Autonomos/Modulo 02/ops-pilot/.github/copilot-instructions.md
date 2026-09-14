# OpsPilot

OpsPilot e um copilot de plantao para gerenciar alertas e incidentes de producao. A APO e um agente LangChain/LangGraph que usa OpenRouter.

## Stack

- Node.js 22 LTS.
- TypeScript ESM com modo strict.
- Express e MySQL.
- Zod na fronteira HTTP e CLI.
- Testes com `node:test` via `tsx`.

## Comandos

- `npm run dev`: inicia a aplicacao.
- `npm run arena`: executa a arena.
- `npm run bench`: executa o benchmark.
- `npm run test`: executa os testes.
- `npm run typecheck`: verifica os tipos.

## Convencoes

- Use as camadas MVC: Model, Service e Controller.
- Sempre utilize funcoes puras.
- Valide toda entrada externa com Zod.
- Modele erros de dominio como classes e converta-os em respostas na borda.
- Toda logica nova deve nascer com teste; `npm run typecheck` e `npm run test` devem permanecer verdes.
- Nunca versione segredos nem leia arquivos `.env`.

## Fluxo de trabalho

Siga o Spec Kit na ordem `/speckit.specify` -> `plan` -> `task` -> `implement`. Versione os artefatos gerados em `specs/`.

1. **Specify**: crie `spec.md` a partir do requisito, com cenarios de usuario, requisitos funcionais testaveis, criterios de sucesso mensuraveis, entidades, limites e premissas. Resolva esclarecimentos pendentes e conclua o checklist de qualidade antes do planejamento.
2. **Plan**: use a especificacao e a constituicao do projeto para produzir `plan.md`, `research.md`, `data-model.md`, contratos em `contracts/` quando houver interface externa e `quickstart.md`. Registre decisoes, alternativas avaliadas, arquitetura e cenarios de validacao.
3. **Task**: gere `tasks.md` a partir da especificacao e do plano. Organize tarefas por historia de usuario e prioridade, explicite dependencias, caminhos de arquivos, criterios de teste independente e oportunidades de paralelismo. Cada tarefa deve usar checkbox, identificador sequencial e descricao acionavel.
4. **Implement**: valide os checklists sem altera-los, execute as tarefas na ordem e marque cada uma como concluida em `tasks.md`. Respeite dependencias, escreva testes antes da implementacao quando previstos e valide cada fase. Ao final, confirme aderencia a especificacao e ao plano, com `npm run typecheck` e `npm run test` verdes.