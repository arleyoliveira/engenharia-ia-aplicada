<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0
- Modified principles: none (I–VI titles unchanged)
- Added sections: VII. Persistência embarcada (SQLite)
- Removed sections: none
- Stack change: MySQL removed from mandatory stack; SQLite embarcado
  (`node:sqlite` / DatabaseSync) is now the required operational store
- Follow-up TODOs: none
-->

# OpsPilot Constitution

## Core Principles

### I. Camadas explícitas (MVC)
O código MUST ser organizado em camadas MVC: Model, Service e Controller.
O domínio não faz IO; efeitos colaterais ficam nas bordas (HTTP/CLI). A
lógica de domínio MUST ser escrita como funções puras.

### II. Validação na fronteira
Toda entrada externa (HTTP/CLI/ferramentas do agente) MUST ser validada
com Zod antes de virar domínio. Nenhum dado não validado atravessa a
fronteira da aplicação.

### III. Erros de domínio
Falhas previsíveis MUST ser modeladas como classes de erro de domínio,
traduzidas em respostas (HTTP/CLI) na borda. O domínio nunca expõe
detalhes de transporte.

### IV. Teste é parte da tarefa (NON-NEGOTIABLE)
Nenhuma lógica nova entra sem teste. `npm run typecheck` e `npm run test`
MUST permanecer verdes a cada entrega.

### V. Segurança por padrão
Sem segredos no repositório; arquivos `.env` nunca são lidos nem
versionados. Variáveis de ambiente via opção nativa do Node (sem dotenv).
Ações destrutivas seguem a deny list do agente, não a confiança do
modelo.

### VI. Spec antes do código
Mudanças relevantes passam por `/speckit.specify` -> `plan` -> `task` ->
`implement`, com os artefatos gerados versionados em `specs/`.

### VII. Persistência embarcada (SQLite)
O store operacional MUST usar SQLite embarcado (`node:sqlite`,
`DatabaseSync`). O caminho do arquivo MUST vir de `OPSPILOT_DB`, com
padrão `./data/opspilot.db`. Testes MUST usar banco volátil em memória
(`:memory:`). Toda consulta MUST usar statement preparado; concatenar SQL
com entrada externa é proibido. O mock em memória permanece apenas para
testes e para o bench, para que cenários possam ser reproduzidos. O
diretório de dados local (`data/`) MUST estar no `.gitignore`. Servidor
de banco tradicional (MySQL, PostgreSQL e equivalentes) está fora da
stack obrigatória.

## Stack obrigatória

Node.js 22 LTS, TypeScript ESM strict, Express, SQLite via `node:sqlite`,
Zod, `node:test` via `tsx`. A APO é um agente LangChain/LangGraph sobre
OpenRouter.

## Fluxo de trabalho

Siga o Spec Kit na ordem `/speckit.specify` -> `plan` -> `task` ->
`implement`. Versione os artefatos gerados em `specs/`.

1. **Specify**: crie `spec.md` com cenários de usuário, requisitos
   funcionais testáveis, critérios de sucesso mensuráveis, entidades,
   limites e premissas. Resolva esclarecimentos pendentes e conclua o
   checklist de qualidade antes do planejamento.
2. **Plan**: use a especificação e esta constituição para produzir
   `plan.md`, `research.md`, `data-model.md`, contratos em `contracts/`
   quando houver interface externa e `quickstart.md`.
3. **Task**: gere `tasks.md` organizado por história de usuário e
   prioridade, com dependências, caminhos de arquivos, critérios de
   teste independente e oportunidades de paralelismo.
4. **Implement**: execute as tarefas na ordem, marcando cada uma como
   concluída em `tasks.md`. Escreva testes antes da implementação quando
   previstos e valide cada fase. Ao final, confirme aderência à
   especificação e ao plano, com `npm run typecheck` e `npm run test`
   verdes.

## Governance

Esta constituição se sobrepõe a outras práticas. Toda spec, plano, tarefa
e código MUST seguir os princípios acima; violações precisam de
justificativa documentada. Emendas exigem atualização deste arquivo e do
espelho em `specs/constituition.md`.

**Version**: 2.0.0 | **Ratified**: 2026-09-04 | **Last Amended**: 2026-09-15
