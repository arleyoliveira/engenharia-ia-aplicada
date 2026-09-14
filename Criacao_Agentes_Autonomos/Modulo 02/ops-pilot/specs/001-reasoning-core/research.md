# Research: Núcleo de Raciocínio do OpsPilot

**Date**: 2026-09-04 | **Feature**: [spec.md](spec.md)

Nenhum NEEDS CLARIFICATION permaneceu no Technical Context — a descrição da feature já fixa stack, arquivos e limites. As decisões abaixo consolidam como aplicar as versões instaladas e os padrões das bibliotecas.

## R1. Estratégia ReAct com o agente pré-construído do LangGraph

- **Decision**: Usar `createReactAgent` de `@langchain/langgraph/prebuilt` (confirmado na versão instalada 1.1.x, em `dist/prebuilt/react_agent_executor`), com `llm` (ChatOpenAI) e `tools` (array de ferramentas LangChain criadas com `tool()` + schemas Zod).
- **Rationale**: O agente pré-construído já implementa o loop raciocinar→agir→observar com roteamento condicional testado; evita reescrever a máquina de estados ReAct.
- **Alternatives considered**: (a) ReAct manual com `StateGraph` + `ToolNode` + `shouldContinue` — mais controle, mas duplica o que o pré-construído já fornece e aumenta superfície de teste; (b) `AgentExecutor` legado do LangChain — deprecado em favor do LangGraph.
- **Captura de trace**: invocar com `streamMode: "values"` (ou inspecionar `result.messages`) e converter cada `AIMessage` com `tool_calls` em evento `action` (tool + args), cada `ToolMessage` em `observation` e o `AIMessage` final em `answer`. Eventos `thought` derivam do conteúdo textual das `AIMessage` intermediárias.

## R2. Plan-and-Execute como grafo customizado

- **Decision**: `StateGraph` com `StateSchema` contendo `input`, `plan: string[]`, `pastSteps: [string, string][]` e `response`. Três nós:
  - **planner**: `llm.withStructuredOutput(z.object({ steps: z.array(z.string()).max(8) }))` — saída estruturada com lista de passos (teto de 8 imposto no schema);
  - **executor**: executa o primeiro passo restante, chamando o modelo com tools (loop ReAct de 1 passo ou chamada única com `bindTools`) e registra `(passo, resultado)` em `pastSteps`;
  - **replanner**: `withStructuredOutput` com união discriminada `{ action: "respond", response } | { action: "continue", steps }` — revisa o restante após cada passo; aresta condicional vai a END quando `action === "respond"` ou não restam passos.
- **Rationale**: É o padrão canônico documentado para plan-and-execute no LangGraph JS; a união discriminada no replanner torna o encerramento explícito e testável.
- **Alternatives considered**: (a) replanner implícito (executor decide o fim) — mistura responsabilidades e dificulta o trace de `plan`/`critique`; (b) plano livre em texto — não-testável; saída estruturada Zod é obrigatória pela constituição.

## R3. Fábrica única de modelo (OpenRouter)

- **Decision**: `src/agents/model.ts` exporta `createModel()` retornando `new ChatOpenAI({ apiKey, model, temperature: 0, configuration: { baseURL: "https://openrouter.ai/api/v1" } })`, lendo `process.env.OPENROUTER_API_KEY` / `OPENROUTER_MODEL` e lançando `ConfigError` quando ausentes/vazias.
- **Rationale**: `ChatOpenAI` aceita `configuration.baseURL`, que é o mecanismo oficial para gateways compatíveis com OpenAI como o OpenRouter; temperatura 0 dá determinismo exigido para comparação na arena.
- **Alternatives considered**: (a) `ChatOpenRouter`/pacote de terceiros — dependência extra sem ganho; (b) ler `.env` com dotenv — proibido pela constituição; usa-se `--env-file` nativo do Node 22.

## R4. Persistência: Sequelize + mysql2 + seed

- **Decision**: Adicionar `sequelize` e `mysql2` às dependências (o `mysql` legado instalado não é dialeto suportado pelo Sequelize moderno). Models `Service`, `Alert`, `Incident` com `sequelize.sync()` no seed; conexão via `DATABASE_URL`.
- **Rationale**: O pedido exige Sequelize sobre MySQL; `mysql2` é o driver oficial do dialeto. `@types/sequelize` instalado é um stub obsoleto — o Sequelize 6 fornece tipos próprios; o stub pode ser removido no implement se conflitar.
- **Alternatives considered**: (a) driver `mysql` legado com SQL na mão — perde validações e migrações do ORM; (b) `mysql2` puro sem ORM — contradiz o pedido.
- **Testes sem banco real**: o store recebe os models por injeção; testes usam fakes in-memory (ou SQLite em memória via Sequelize, se necessário), mantendo `node:test` determinístico e sem rede/IO.

## R5. Contagem de chamadas de LLM e latência

- **Decision**: Envolver o modelo num contador: callback `callbacks: [{ handleLLMStart }]` no invoke/stream incrementa `llmCalls`; `latencyMs = performance.now() - start` medido no `run()` da estratégia.
- **Rationale**: Callbacks do LangChain são o ponto de instrumentação suportado e contam chamadas reais (incluindo as internas do planner/replanner), satisfazendo SC-006.
- **Alternatives considered**: (a) contar mensagens AI no trace — subconta chamadas (uma chamada pode gerar 1 mensagem, mas retries/streaming confundem); (b) wrapper de Proxy sobre o modelo — frágil frente a internals.

## R6. Ambiente e flags de CLI

- **Decision**: Scripts `dev`/`arena`/`bench` passam a usar `tsx --env-file=.env` (se `.env` existir) ou o operador exporta as variáveis; flags `--strategies react,plan-and-execute` e `--max-iterations N` parseadas com `node:util` `parseArgs` e validadas com Zod.
- **Rationale**: `--env-file` é nativo do Node 22 (sem dotenv, conforme constituição); `parseArgs` é nativo e suficiente para 2 flags.
- **Alternatives considered**: (a) dotenv — proibido; (b) commander/yargs — dependência desnecessária para duas flags.

## R7. Limite de iterações

- **Decision**: ReAct usa `recursionLimit` no invoke do grafo (LangGraph interrompe com erro de recursão → mapeado para `IterationLimitError`); Plan-and-Execute checa contador próprio no roteador do replanner, além do teto de 8 passos no schema.
- **Rationale**: `recursionLimit` é o mecanismo nativo do LangGraph; o teto de 8 é uma invariante de domínio, então vive no schema Zod do planner.
- **Alternatives considered**: loop manual com contador para o ReAct — abandonaria o agente pré-construído (ver R1).
