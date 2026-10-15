# Data Model: Núcleo de Raciocínio do OpsPilot

**Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

## Entidades persistidas (MySQL via Sequelize)

### Service

| Campo | Tipo | Regras |
|-------|------|--------|
| id | INTEGER PK auto-increment | — |
| name | STRING único, não nulo | 1–120 chars |

Relacionamentos: `Service hasMany Alert`, `Service hasMany Incident`.

### Alert

| Campo | Tipo | Regras |
|-------|------|--------|
| id | INTEGER PK auto-increment | — |
| serviceId | INTEGER FK → Service.id | não nulo |
| title | STRING | não nulo, 1–200 chars |
| status | ENUM('firing', 'resolved') | não nulo |

Transições de estado: `firing → resolved` (via resolução futura — fora de escopo nesta feature; seed já traz 3 de cada). Nenhum endpoint de mutação de alerta nesta feature.

### Incident

| Campo | Tipo | Regras |
|-------|------|--------|
| id | INTEGER PK auto-increment | — |
| serviceId | INTEGER FK → Service.id | não nulo, deve existir |
| title | STRING | não nulo, 1–200 chars |
| severity | ENUM('low', 'medium', 'high', 'critical') | não nulo |
| status | ENUM('open', 'resolved') | default 'open' |
| createdAt / resolvedAt | DATE | resolvedAt nulo até resolução |

Transições: `open → resolved` via `resolve_incident(id)`. Resolver id inexistente → `NotFoundError`. Resolver incidente já resolvido → erro de domínio (`InvalidStateError`) ou idempotente — **decisão**: idempotente, retorna o incidente já resolvido (mais seguro para agentes que repetem chamadas).

## Tipos de domínio (não persistidos — TypeScript puro)

```text
TraceEventType = "thought" | "action" | "observation" | "plan" | "critique" | "answer"

TraceEvent =
  | { type: "thought" | "observation" | "critique"; content: string }
  | { type: "action"; tool: string; args: unknown }
  | { type: "plan"; steps: string[] }
  | { type: "answer"; content: string }

Metrics    = { llmCalls: number; latencyMs: number }

StrategyResult = { answer: string; trace: TraceEvent[]; metrics: Metrics }

ReasoningStrategy = {
  name: string;
  run(input: string, options?: { maxIterations?: number }): Promise<StrategyResult>;
}
```

Regras:
- `TraceEvent` é união discriminada fechada (spec: conjunto fechado de tipos).
- `action` sempre carrega `tool` + `args` (FR-002).
- Serialização do trace é função pura e determinística (base dos testes sem rede).

## Seed (catálogo inicial — `src/scripts/seed.ts`)

5 serviços: `api-gateway`, `auth-service`, `billing`, `notifications`, `search`.

6 alertas:
| # | Serviço | Título | Status |
|---|---------|--------|--------|
| 1 | api-gateway | Latência p95 acima de 2s | firing |
| 2 | auth-service | Taxa de erro 5xx > 5% | firing |
| 3 | billing | Fila de pagamentos acumulando | firing |
| 4 | notifications | Envio de e-mails normalizado | resolved |
| 5 | search | Índice reconstruído | resolved |
| 6 | api-gateway | Deploy concluído sem erros | resolved |

Idempotência: o seed usa `findOrCreate` por chave natural (nome do serviço, título do alerta) — reexecutar não duplica o catálogo (edge case do spec).
