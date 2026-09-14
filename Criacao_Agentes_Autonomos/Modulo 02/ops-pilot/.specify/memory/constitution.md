# OpsPilot Constitution

## Core Principles

### I. Camadas explícitas (MVC)
O código é organizado em camadas MVC: Model, Service e Controller. O domínio não faz IO; efeitos colaterais ficam nas bordas (HTTP/CLI). A lógica de domínio é sempre escrita como funções puras.

### II. Validação na fronteira
Toda entrada externa (HTTP/CLI) é validada com Zod antes de virar domínio. Nenhum dado não validado atravessa a fronteira da aplicação.

### III. Erros de domínio
Falhas previsíveis são modeladas como classes de erro de domínio, traduzidas em respostas (HTTP/CLI) na borda. O domínio nunca expõe detalhes de transporte.

### IV. Teste é parte da tarefa (NON-NEGOTIABLE)
Nenhuma lógica nova entra sem teste. `npm run typecheck` e `npm run test` devem permanecer verdes a cada entrega.

### V. Segurança por padrão
Sem segredos no repositório; arquivos `.env` nunca são lidos nem versionados. Variáveis de ambiente via opção nativa do Node (sem dotenv). Ações destrutivas seguem a deny list do agente, não a confiança do modelo.

### VI. Spec antes do código
Mudanças relevantes passam por `/speckit.specify` -> `plan` -> `task` -> `implement`, com os artefatos gerados versionados em `specs/`.

## Stack obrigatória

Node.js 22 LTS, TypeScript ESM strict, Express, MySQL, Zod, `node:test` via `tsx`. A APO é um agente LangChain/LangGraph sobre OpenRouter.

## Fluxo de trabalho

Siga o Spec Kit na ordem `/speckit.specify` -> `plan` -> `task` -> `implement`. Versione os artefatos gerados em `specs/`.

1. **Specify**: crie `spec.md` com cenários de usuário, requisitos funcionais testáveis, critérios de sucesso mensuráveis, entidades, limites e premissas. Resolva esclarecimentos pendentes e conclua o checklist de qualidade antes do planejamento.
2. **Plan**: use a especificação e esta constituição para produzir `plan.md`, `research.md`, `data-model.md`, contratos em `contracts/` quando houver interface externa e `quickstart.md`.
3. **Task**: gere `tasks.md` organizado por história de usuário e prioridade, com dependências, caminhos de arquivos, critérios de teste independente e oportunidades de paralelismo.
4. **Implement**: execute as tarefas na ordem, marcando cada uma como concluída em `tasks.md`. Escreva testes antes da implementação quando previstos e valide cada fase. Ao final, confirme aderência à especificação e ao plano, com `npm run typecheck` e `npm run test` verdes.

## Governance

Esta constituição se sobrepõe a outras práticas. Toda spec, plano, tarefa e código deve seguir os princípios acima; violações precisam de justificativa documentada. Emendas exigem atualização deste arquivo e do espelho em `specs/constituition.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-04 | **Last Amended**: 2026-09-04
