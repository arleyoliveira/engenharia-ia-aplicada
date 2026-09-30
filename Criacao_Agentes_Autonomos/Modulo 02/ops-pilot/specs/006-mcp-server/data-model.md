# Data Model: Servidor MCP OpsPilot

**Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

Não há entidades novas persistidas. O MCP reutiliza o modelo operacional existente (`AlertRecord`, `IncidentRecord`, `OpsStore`). Este documento descreve os tipos de borda MCP e o fluxo de invocação.

## Entidades reutilizadas (já existentes)

### AlertRecord

```text
AlertRecord = {
  id: number
  serviceId: number
  service?: string
  title: string
  status: "firing" | "resolved"
}
```

### IncidentRecord

```text
IncidentRecord = {
  id: number
  title: string
  serviceId: number
  service?: string
  severity: "low" | "medium" | "high" | "critical"
  status: "open" | "resolved"
  createdAt: string
  resolvedAt: string | null
  summary: string | null
}
```

### OpsStore (contrato)

Métodos usados pelo MCP v1:

- `listAlerts(filter?: { status?: AlertStatus })`
- `openIncident({ title, service, severity })`
- `resolveIncident({ id })`

## Tipos de borda MCP

### McpServerIdentity

```text
McpServerIdentity = {
  name: "opspilot"
  version: string   // espelha package.json (ex.: "0.1.0")
}
```

### OpsMcpToolName (escopo v1)

```text
OpsMcpToolName = "list_alerts" | "open_incident" | "resolve_incident"
```

### OpsToolDef (fonte única)

```text
OpsToolDef<TArgs> = {
  name: OpsMcpToolName
  description: string
  schema: ZodObject   // args
  execute: (store: OpsStore, args: TArgs) => Promise<string>  // JSON serializado
}
```

LangChain `tool()` e registro MCP consomem o mesmo `OpsToolDef`.

### Tool result payloads (paridade com agente)

```text
ListAlertsResult   = { alerts: AlertRecord[] }
OpenIncidentResult = { incident: IncidentRecord }
ResolveResult      = { incident: IncidentRecord }
DomainFailure      = { error: { code: string, message: string } }
```

Sempre serializados como **string JSON** no `content[].text` da resposta MCP.

## Fluxo de invocação

```text
Cliente MCP
  → tools/list
      → retorna as 3 OpsMcpToolName (+ inputSchema derivado do Zod compartilhado)
  → tools/call (name, arguments)
      → validação Zod (schema compartilhado)
      → OpsToolDef.execute(store, args)
          → sucesso → content text = JSON resultado
          → DomainError → content text = JSON DomainFailure (isError se suportado)
```

## Transições de estado (domínio, inalteradas)

```text
Incident: open → resolved  (via resolve_incident; idempotente se já resolved)
Alert:    firing | resolved (somente leitura via list_alerts nesta feature)
```

## Regras de validação (schemas compartilhados)

| Tool              | Args |
|-------------------|------|
| `list_alerts`     | `status?: "firing" \| "resolved"` |
| `open_incident`   | `title` 1–200; `service` min 1; `severity` enum |
| `resolve_incident`| `id` int positivo |

Descrições de parâmetros via `.describe()` na fonte única (mesmas regras das tools do agente).
