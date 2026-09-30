# Research: Orçamento de contexto por seção

**Date**: 2026-09-22 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição e o pipeline atual `runChat` → estratégias → `composeChatPrompt` / `toAgentMessages`.

## R1. Onde aplicar o orçamento (wiring)

- **Decision**: Aplicar o orçamento em `runChat` **depois** de carregar janela (`HISTORY_WINDOW`), resumo e recall, e **antes** de `strategy.run`. Passar ao strategy apenas o `ChatTurnInput` já orçado. Estratégias continuam usando `composeChatPrompt` / `toAgentMessages` / `normalizeChatTurnInput` sem conhecer tetos.
- **Rationale**: FR-001/FR-009 — um único ponto para todas as estratégias; zero bypass; formatação existente preservada.
- **Alternatives considered**: (a) cada estratégia orça sozinha — drift e viola “todas”; (b) mover formatação inteira para o builder e remover `compose-chat-prompt` nesta feature — escopo maior sem ganho obrigatório; (c) orçar dentro de `composeChatPrompt` — mistura formatação com política e dificulta injetar scores.

## R2. API do ContextBuilder

- **Decision**: Módulo puro `src/context/context-builder.ts` exporta:
  - `DEFAULT_SECTION_BUDGETS = { summary: 200, window: 1200, memories: 300 }`
  - `resolveSectionBudgets(env?: NodeJS.ProcessEnv): SectionBudgets`
  - `buildBudgetedContext(input: ContextBuilderInput, budgets: SectionBudgets): BudgetedContext`
  - Helpers de corte testáveis isoladamente (ou funções internas cobertas via `buildBudgetedContext`)
- **Rationale**: Domínio puro (constituição I); env na borda via `resolveSectionBudgets(process.env)` chamado por `runChat`.
- **Alternatives considered**: builder que lê `process.env` internamente — acopla domínio a IO implícito.

## R3. Nomes das variáveis de ambiente

- **Decision**:
  - `CONTEXT_BUDGET_SUMMARY` (padrão 200)
  - `CONTEXT_BUDGET_WINDOW` (padrão 1200)
  - `CONTEXT_BUDGET_MEMORIES` (padrão 300)
  - Parse: string trimada → inteiro finito `> 0`; caso contrário, padrão da seção. Sem dotenv.
- **Rationale**: Spec `CONTEXT_BUDGET_*`; alinhado a `OPSPILOT_DB` / `PORT` (env nativo).
- **Alternatives considered**: um JSON único `CONTEXT_BUDGETS` — menos explícito e mais frágil na CLI.

## R4. Seção `system`

- **Decision**: `ContextBuilderInput.system?: string` passa **intocado** para `BudgetedContext.system`. O `runChat` atual **não** precisa preencher system (prompts de sistema das estratégias — planner, critic, ReAct — permanecem internos a cada agente e fora do orçamento). Testes unitários do builder cobrem system presente/ausente.
- **Rationale**: Spec exige seção system intocável; estratégias já têm system próprio que o builder não vê (também “intocável” por construção).
- **Alternatives considered**: extrair system prompts das estratégias para o builder — refactor grande fora do escopo.

## R5. Política de corte — window

- **Decision**: Enquanto `sum(estimateTokens(msg.content)) > budget.window`, remover a mensagem no **início** da lista (mais antiga). Se uma mensagem individual `estimateTokens(content) > budget.window`, ela também é removida (não entra). Ordem relativa das sobreviventes preservada (mais recentes no fim).
- **Rationale**: FR-005; lista de `lastMessages` já vem cronológica antiga→recente.
- **Alternatives considered**: truncar conteúdo da mensagem antiga — viola “corta as mais antigas” (mensagem inteira).

## R6. Política de corte — memories

- **Decision**: Entrada `memories: { fact: string; score: number }[]` (ordem = ranking do recall, melhor primeiro). Enquanto a soma dos `estimateTokens(fact)` dos mantidos > `budget.memories`, remover o de **menor score**; em empate de score, remover o de **pior ranking** (último entre os empatados na lista atual). Fato individual > teto: não entra. Saída: `string[]` de fatos sobreviventes (ordem estável dos mantidos, preferindo manter a ordem original de ranking entre sobreviventes).
- **Rationale**: FR-006 + assumption de empate; `runChat` hoje descarta score — passar hits completos ao builder.
- **Alternatives considered**: cortar pelo final da lista sem olhar score — viola pedido; re-sort a cada remoção O(n²) aceitável para top-k pequeno.

## R7. Política de corte — summary

- **Decision**: Se `estimateTokens(summary) <= budget.summary`, manter. Senão, reduzir ao **prefixo** com comprimento máximo `4 * budget.summary + 3` (garante `floor(len/4) <= budget`), depois se necessário encolher 1 char até caber (paranoia de borda). Trim final opcional só de espaços à direita do prefixo. String vazia após corte → tratar como ausente.
- **Rationale**: Assumption da spec (manter início); unidade = `estimateTokens`.
- **Alternatives considered**: truncar por sentença — não determinístico o bastante para teste de teto baixo; hard cut no meio sem regra de `4*B+3` — pode ainda estourar o piso.

## R8. Métricas pós-corte

- **Decision**: `historyMessages`, `recalledMemories` e `estimateContextBreakdown({ message, history, memories, summary })` usam exclusivamente o material de `BudgetedContext` (após corte).
- **Rationale**: FR-010; evita mentir na observabilidade.
- **Alternatives considered**: breakdown no bruto + flags de corte — fora do escopo e confunde o script/métricas atuais.

## R9. Relação com janela de 8 mensagens (011)

- **Decision**: Manter `HISTORY_WINDOW = 8` em `lastMessages` **antes** do orçamento. O builder pode reduzir ainda mais a janela se a estimativa > 1200 (ou teto de teste).
- **Rationale**: Assumption da spec; orçamento por tokens é camada adicional, não substitui a janela por contagem.
- **Alternatives considered**: pular `lastMessages` e deixar só o builder — mudaria o contrato 011 sem pedido.

## R10. Testes com tetos baixos

- **Decision**: Nos unitários, passar `SectionBudgets` explícitos baixos (não depender de mutar `process.env` global, exceto 1–2 casos de `resolveSectionBudgets`). Casos mínimos: (a) system+message intactos; (b) 3 msgs, teto que só cabe a mais recente; (c) 3 memórias scores 0.9/0.5/0.2, teto que só cabe as duas melhores; (d) resumo longo → prefixo ≤ teto; (e) defaults; (f) env inválido → default.
- **Rationale**: FR-011 / SC-007; determinismo sem rede.
- **Alternatives considered**: só teste de integração HTTP — mais lento e menos preciso na ordem de corte.
