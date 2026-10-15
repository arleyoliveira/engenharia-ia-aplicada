# Contract: Tools MCP OpsPilot

Servidor MCP local **`opspilot`**, transporte **stdio**. Escopo v1: exatamente três tools. Schemas e descrições = fonte única compartilhada com as tools do agente (`ops-tool-defs`). Contratos de domínio alinhados a [specs/001-reasoning-core/contracts/tools.md](../../001-reasoning-core/contracts/tools.md).

## Identidade

| Campo     | Valor |
|-----------|--------|
| `name`    | `opspilot` |
| Transport | stdio (stdin/stdout = protocolo) |
| Entrypoint| `npm run mcp` → `tsx --env-file-if-exists=.env src/mcp/server.ts` |

## tools/list (descoberta)

Resposta MUST incluir exatamente:

| name               | Obrigatória |
|--------------------|-------------|
| `list_alerts`      | sim |
| `open_incident`    | sim |
| `resolve_incident` | sim |

MUST NOT exigir na aceitação desta feature: `list_incidents`, `consultar_runbook`, `check_provider_status`.

Cada tool expõe `description` e `inputSchema` derivados do Zod compartilhado.

## list_alerts

Lista alertas do store, filtro opcional por status.

```typescript
// Input (Zod compartilhado)
z.object({
  status: z.enum(["firing", "resolved"]).optional()
    .describe("Filtro de status do alerta ('firing' ou 'resolved'). Omita para listar todos os alertas."),
})

// Output (content text = JSON string)
{ "alerts": [ /* AlertRecord */ ] }
```

Somente leitura. Erros previsíveis → JSON `{ "error": { "code", "message" } }`.

## open_incident

Abre incidente no OpsStore compartilhado.

```typescript
z.object({
  title: z.string().min(1).max(200).describe("Título resumido e descritivo do incidente."),
  service: z.string().min(1).describe("Nome do serviço afetado (ex: 'checkout', 'payments', 'auth')."),
  severity: z.enum(["low", "medium", "high", "critical"])
    .describe("Nível de severidade: 'low', 'medium', 'high' ou 'critical'."),
})

// Output
{ "incident": { /* IncidentRecord status open */ } }
```

Efeito colateral: cria registro. Validação na fronteira; serviço inexistente → erro de domínio serializado.

## resolve_incident

Marca incidente como resolvido (idempotente).

```typescript
z.object({
  id: z.number().int().positive()
    .describe("Identificador numérico do incidente que deve ser marcado como resolvido."),
})

// Output
{ "incident": { /* IncidentRecord status resolved */ } }
```

Id inexistente → erro de domínio serializado.

## Canal stdio

| Canal   | Uso |
|---------|-----|
| stdout  | Somente mensagens do protocolo MCP |
| stderr  | Diagnóstico opcional (`console.error`) |
| stdout  | **Proibido** para `console.log` / logs de aplicação |

## Resposta MCP de tool

```typescript
{
  content: [{ type: "text", text: "<json string>" }],
  isError?: boolean  // true quando DomainFailure
}
```

Paridade: a string `text` MUST ser a mesma que a tool LangChain correspondente retornaria para o mesmo store e args.
