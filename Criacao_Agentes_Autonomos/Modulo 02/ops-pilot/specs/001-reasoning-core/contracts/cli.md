# Contract: Interfaces CLI

## Arena — `npm run arena -- [flags] "<input>"`

Executa 1+ estratégias sobre o mesmo input e imprime, para cada uma: nome, resposta, trace formatado e métricas.

### Flags (parseArgs + Zod)

| Flag | Tipo | Default | Regras |
|------|------|---------|--------|
| `--strategies` | string CSV | `"react"` | subconjunto de `react,plan-and-execute`; nome desconhecido → erro com a lista disponível |
| `--max-iterations` | int | `8` | inteiro positivo; repassado a cada estratégia |

### Comportamento

1. Valida flags e input (Zod na fronteira). Erro → mensagem clara, exit 1.
2. Carrega variáveis (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) via `--env-file` nativo ou ambiente; ausência → `ConfigError` → mensagem clara, exit 1.
3. Executa cada estratégia sequencialmente sobre **exatamente o mesmo input**.
4. Imprime blocos separados por estratégia:

```text
=== react ===
Answer: ...
Trace:
  [plan] ...
  [action] list_alerts({"status":"firing"})
  [observation] ...
  [answer] ...
Metrics: llmCalls=4 latencyMs=3210
```

### Exemplos

```bash
node --env-file=.env node_modules/.bin/tsx src/arena.ts --strategies react --max-iterations 4 "Quais alertas estão disparando? Abra um incidente para o mais crítico."
node --env-file=.env node_modules/.bin/tsx src/arena.ts --strategies react,plan-and-execute "Resolva os incidentes abertos do billing."
```

## Seed — `tsx src/scripts/seed.ts`

- Cria as tabelas (sync) e insere o catálogo ([data-model.md](../data-model.md)): 5 serviços, 6 alertas (3 firing, 3 resolved).
- Idempotente (`findOrCreate` por chave natural); saída: resumo contando serviços/alertas presentes.
- Requer `DATABASE_URL`; ausência → `ConfigError` → mensagem clara, exit 1.
