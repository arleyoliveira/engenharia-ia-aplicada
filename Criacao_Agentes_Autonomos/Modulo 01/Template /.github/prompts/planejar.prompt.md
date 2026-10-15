---
mode: agent
description: Gere o plano técnico (COMO) a partir de uma spec existente.
---

Gere um PLANO TÉCNICO da feature indicada (o texto após o comando é o número ou o caminho).

Regras:

- Resolva a spec alvo assim:
  - Se a entrada for um número (ex: 001), use `specs/<NNN>-*-spec.md`.
  - Se a entrada for um caminho de arquivo, use exatamente esse arquivo.
  - Se houver mais de um arquivo para o mesmo número, pare e peça decisão humana.
- Leia a spec resolvida e `specs/constituition.md`.
- Crie o plano no mesmo diretório da spec, com nome derivado da spec:
  - Se a spec for `specs/<NNN>-<slug>-spec.md`, gere `specs/<NNN>-<slug>-plan.md`.
  - Nunca usar nome genérico `plan.md`.
  - Se o arquivo de plano já existir, atualize esse arquivo.
- O conteúdo do plano deve conter:
  1. Arquitetura: camadas e arquivos criados/alterados (http/cli -> service -> store).
  2. Modelo de dados: tipos e schemas Zod.
  3. Contratos: rotas HTTP e/ou comandos de CLI, com entrada/saída.
  4. Decisões e trade-offs.
  5. Estratégia de testes (`node:test`).
- Não implemente nada ainda.
- Aponte riscos e pontos que precisarão de decisão humana.
