# Quickstart: Núcleo de Raciocínio do OpsPilot

Validação ponta a ponta da feature. Contratos detalhados: [contracts/](contracts/), entidades: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e MySQL local rodando.
- `.env` (nunca versionado) a partir de `.env.example`:

```bash
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4o-mini   # exemplo
DATABASE_URL=mysql://root:senha@localhost:3306/ops_pilot
```

## Cenário 1 — Seed do catálogo (SC-001)

```bash
node --env-file=.env node_modules/.bin/tsx src/scripts/seed.ts
```

**Esperado**: `5 services, 6 alerts (3 firing, 3 resolved)`. Reexecutar → mesma contagem (idempotente), sem duplicatas.

## Cenário 2 — Testes determinísticos sem rede (SC-003)

```bash
npm run test
```

**Esperado**: testes de store (list/filtro, open, resolve, rejeições de validação) e de formatação de trace passam em < 10s, sem rede e sem banco real (fakes em memória).

## Cenário 3 — Arena com uma estratégia (US1)

```bash
node --env-file=.env node_modules/.bin/tsx src/arena.ts \
  --strategies react --max-iterations 4 \
  "Quais alertas estão em firing? Abra um incidente high para o primeiro."
```

**Esperado**: bloco `=== react ===` com resposta, trace tipado contendo ao menos um `[action] list_alerts(...)` e um `[action] open_incident(...)`, e `Metrics: llmCalls=N latencyMs=M`.

## Cenário 4 — Comparação de estratégias (US1, FR-011)

```bash
node --env-file=.env node_modules/.bin/tsx src/arena.ts \
  --strategies react,plan-and-execute \
  "Liste os alertas firing e abra incidentes para os dois mais críticos."
```

**Esperado**: dois blocos (`react`, `plan-and-execute`) sobre o mesmo input; o bloco plan-and-execute contém eventos `[plan]` com ≤ 8 passos; ambos reportam `llmCalls` e `latencyMs` nos mesmos campos.

## Cenário 5 — Limite de iterações (FR-010)

```bash
node --env-file=.env node_modules/.bin/tsx src/arena.ts --strategies react --max-iterations 1 "Resolva todos os alertas."
```

**Esperado**: encerramento controlado, trace termina indicando limite atingido (evento `critique`), sem travar, exit 0.

## Cenário 6 — Falhas previsíveis na borda (FR-013)

```bash
node_modules/.bin/tsx src/arena.ts --strategies react "teste"   # sem --env-file / sem OPENROUTER_API_KEY
```

**Esperado**: mensagem clara de configuração ausente, exit 1, nenhuma chamada de rede.
