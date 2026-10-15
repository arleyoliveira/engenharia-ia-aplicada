# Research: Camada de Reflection para Estratégias de Raciocínio

**Date**: 2026-09-11 | **Feature**: [spec.md](spec.md)

Nenhum marcador `[NEEDS CLARIFICATION]` pendente. As decisões abaixo consolidam a arquitetura, padrões e contratos de integração da camada de reflexão com as estratégias existentes e a arena.

## R1. Função decoradora de ordem superior (`withReflection`)

- **Decision**: Criar a função pura `withReflection(strategy: ReasoningStrategy, options?: ReflectionOptions): ReasoningStrategy` em `src/agents/reflection.ts`.
- **Rationale**: Preserva 100% o contrato unificado `ReasoningStrategy` (`name`, `run(input, options)`), permitindo que qualquer estratégia existente (`react`, `plan-and-execute` ou futuras) seja envolvida transparentemente sem acoplamento ou modificação interna.
- **Alternatives considered**:
  - (a) Herança de classes: viola a convenção funcional do projeto e dificulta composição.
  - (b) Modificar as estratégias base internamente: duplicaria a lógica de reflexão dentro de cada estratégia e violaria o princípio de responsabilidade única.

## R2. Estrutura do Crítico e Saída Estruturada

- **Decision**: O componente crítico utiliza a fábrica única `createModel()` combinada com `.withStructuredOutput(critiqueSchema, { method: "functionCalling" })`, onde `critiqueSchema = z.object({ approved: z.boolean().describe("Se a resposta proposta é factualmente consistente com as observações do trace e resolve o input."), feedback: z.string().describe("Instruções corretivas claras caso reprovado, ou justificativa concisa caso aprovado.") })`.
- **Rationale**: `functionCalling` provou ser o método mais estável e compatível entre modelos OpenRouter (inclusive modelos gratuitos/locais), evitando falhas de parsing de JSON vazio comuns com `jsonSchema`.
- **Alternatives considered**:
  - (a) Parser de texto livre via regex: frágil e sujeito a erros de interpretação de booleanos.
  - (b) Crítico com modelo separado: aumentaria a complexidade de configuração sem necessidade; o spec define usar a mesma fábrica de modelo.

## R3. Extração de Observações e Montagem do Contexto do Crítico

- **Decision**: Uma função pura `extractObservations(trace: TraceEvent[]): string[]` extrai o conteúdo de todos os eventos de tipo `observation`. O prompt do crítico recebe:
  - `Objetivo original`: input do usuário.
  - `Evidências/Observações obtidas`: lista formatada de observações ou indicação de que nenhuma ferramenta foi necessária.
  - `Resposta candidata`: resposta preliminar retornada pela estratégia base.
- **Rationale**: O crítico precisa julgar especificamente se a resposta respeitou os dados reais retornados pelas ferramentas em vez de alucinar ou ignorar restrições (ex.: tentar abrir incidente com serviço que falhou na busca).
- **Alternatives considered**:
  - (a) Passar o trace inteiro: consome mais tokens e inclui pensamentos intermediários irrelevantes para a consistência factual da resposta final.
  - (b) Não passar observações: impossibilita ao crítico validar consistência factual.

## R4. Loop de Auto-Correção e Injeção de Feedback

- **Decision**: Se `approved === false` e `currentReflection < maxReflections`:
  - O feedback do crítico é injetado como instrução corretiva no input da nova execução:
    `${originalInput}\n\n[Feedback do Crítico na tentativa anterior]: ${critique.feedback}`.
  - A estratégia base é invocada novamente.
  - O trace da nova execução é concatenado ao trace global precedido pelo evento `critique`.
  - O ciclo repete até `approved === true` ou atingir `maxReflections` (default: 2).
- **Rationale**: Reutilizar o método `run()` da estratégia base garante que a nova tentativa execute todo o ciclo (re-planejamento ou novas chamadas de ferramentas guiadas pelo feedback).
- **Alternatives considered**:
  - (a) Chamar apenas o LLM sem ferramentas para corrigir a resposta: arriscado quando o erro foi não invocar uma ferramenta necessária.
  - (b) Injetar feedback via system prompt: nem todas as estratégias expõem modificação de system prompt em tempo de execução sem violar o contrato `run(input, options)`.

## R5. Agregação Consolidada de Métricas e Eventos no Trace

- **Decision**:
  - `llmCalls`: contador via callback `createLlmCallCounter()` captura as chamadas do crítico, que são somadas às métricas reportadas pelas execuções da estratégia base.
  - `latencyMs`: calculado de ponta a ponta na função `run()` decorada (`performance.now() - startTime`).
  - `trace`: array acumulativo contendo eventos da base + eventos `{ type: "critique", content: `[${approved ? "APROVADO" : "REPROVADO"}] ${feedback}` }` + evento final `answer`.
- **Rationale**: Satisfaz integralmente os requisitos de observabilidade e comparação justa na arena.
- **Alternatives considered**:
  - (a) Sobrescrever o trace com a última tentativa: perderia o histórico de auto-correção para auditoria.

## R6. Integração com a Arena CLI

- **Decision**: Expandir o mapa de estratégias em `src/arena.ts` para registrar:
  - `react`: estratégia ReAct pura.
  - `plan-and-execute`: estratégia Plan-and-Execute pura.
  - `reflect:react` (e alias `reflec:react`): `withReflection(reactStrategy)`.
  - `reflect:plan-and-execute` (e alias `reflec:plan-and-execute`): `withReflection(planAndExecuteStrategy)`.
- **Rationale**: Permite comparar diretamente a estratégia original com a versão refletida em uma única linha de comando.
