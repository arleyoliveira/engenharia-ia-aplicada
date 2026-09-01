---
mode: agent
description: Quebre o plano em tarefas pequenas, ordenadas e testáveis
---

Gere o tasks.md da feature indicada (o texto após o comando é o número ou caminho).

Regras:

- Resolva a feature alvo assim:
  - Se a entrada for um número (ex: 001), localize os arquivos `specs/<NNN>-*-spec.md` e `specs/<NNN>-*-plan.md`.
  - Se a entrada for um caminho, use esse caminho como referência principal e localize o par correspondente (`-spec.md` ou `-plan.md`) com o mesmo prefixo.
  - Se houver mais de um conjunto para o mesmo número, pare e peça decisão humana.
- Leia sempre a spec e o plano da mesma feature antes de gerar tarefas.
- Gere o arquivo de tarefas no mesmo diretório com nome derivado:
  - Para `specs/<NNN>-<slug>-spec.md` e `specs/<NNN>-<slug>-plan.md`, gerar `specs/<NNN>-<slug>-tasks.md`.
  - Nunca usar nome genérico `tasks.md`.
  - Se o arquivo de tarefas já existir, atualize esse arquivo.
- Produza uma lista numerada em que cada tarefa:
  - é pequena o suficiente para um único commit;
  - tem critério claro de "pronto" (ex: teste X passa);
  - declara dependências, quando houver;
  - começa com "-[ ]" para marcarmos o progresso.
- Ordene por dependência.
- Não implemente nada.
