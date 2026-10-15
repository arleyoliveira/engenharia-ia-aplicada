# Data Model: Modo equipe

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

## Constantes

| Nome | Valor |
|------|--------|
| `PRODUCTION_ROUTES` | `react`, `planExecute`, `reflect`, `team` |
| `TEAM_NEXT` | `analista`, `planejador`, `executor`, `fim` |
| `TEAM_HANDOFF_LIMIT` | `8` |
| Answer de limite | `Execução interrompida: limite de iterações (8) atingido.` |
| `OVERRIDE_REASON` | `estratégia informada pelo cliente` (inalterado) |
| Nós do grafo de produção | `context`, `roteador`, `react`, `planExecute`, `reflect`, `team`, `resposta` |
| Nós do grafo da equipe | `supervisor`, `analista`, `planejador`, `executor`, `limite` |

Allowlists de ferramenta (nome estável já existente):

| Papel | Nomes |
|-------|--------|
| `analista` | `list_alerts`, `list_incidents`, `consultar_runbook`, `check_provider_status` |
| `planejador` | nenhuma |
| `executor` | `open_incident`, `resolve_incident` |

## Entidades

### Blackboard

Estado do turno dentro do grafo da equipe. Não é linha de SQLite.

```text
Blackboard = {
  findings: string
  plan: string
  actions: readonly IncidentAction[]
  briefs: readonly { next: TeamNext; brief: string }[]
}

IncidentAction = {
  tool: "open_incident" | "resolve_incident"
  args: unknown
  observation: string
}

TeamNext = "analista" | "planejador" | "executor" | "fim"
```

Estado inicial: `findings` e `plan` são `""`; `actions` e `briefs` são `[]`.

Regras de escrita:

- O supervisor acrescenta um item em `briefs` ao emitir o handoff.
- O analista só altera `findings`: concatena o texto novo, separado por uma quebra de linha quando já havia achados. Não altera `plan` nem `actions`.
- O planejador só substitui `plan` pela string não vazia desta visita.
- O executor só acrescenta itens em `actions`, um por ferramenta realmente invocada.

### SupervisorDecision

```text
SupervisorDecision = {
  next: TeamNext
  brief: string    // trim; comprimento mínimo 1
}
```

Produzida por `withStructuredOutput`. Inválida → `ModelOutputError` no passo `"supervisor"`, sem executar papel e sem incrementar além do handoff que não chegou a ser aceito.

### TeamGraphState

```text
TeamGraphState = {
  message: string
  blackboard: Blackboard
  handoffs: number          // 0..8, só sobe quando a decisão é aceita
  next: TeamNext | ""
  brief: string
  answer: string
  trace: TraceEvent[]       // reducer concatena
  llmCalls: number
  promptTokens: number
}
```

`visited` não faz parte do contrato HTTP. O teste de ordem pode observar a sequência de `handoff` no `trace`.

### Handoff

```text
Handoff = {
  type: "handoff"
  next: TeamNext
  brief: string
  node: "supervisor"
}
```

Um por decisão aceita. No máximo 8 por turno. Entra no `trace` antes do papel correspondente. `fim` também é handoff e não é seguido de evento de papel.

### Papel

Não é registro. É o nó que só roda se o handoff imediatamente anterior tiver o seu `next`. O `node` dos eventos que ele emite é o id do papel.

Transições do turno:

```text
handoffs = 0, blackboard vazio
  → supervisor
       ├─ decisão inválida → erro, sem papel
       ├─ next = fim → answer = brief → fim do modo
       └─ next = papel → papel roda
            ├─ handoffs < 8 → supervisor
            └─ handoffs = 8 → answer = mensagem de limite → fim do modo
```

O oitavo `fim` usa o `brief`, não a mensagem de limite.

### Rota `team`

Quarto valor de `ProductionRoute`. `ChatRequest.strategy` ausente: o roteador pode devolvê-la e o evento `route` fica `override: false`. `strategy: "team"`: override, modelo do roteador não corre. Nome fora dos quatro valores continua `422` `UNKNOWN_STRATEGY` antes do grafo.

`reflect: true` não inclui `team` nas rotas que o roteador pode escolher e não embrulha o nó `team`.
