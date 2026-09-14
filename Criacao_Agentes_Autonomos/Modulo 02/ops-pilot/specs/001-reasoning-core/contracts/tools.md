# Contract: Ferramentas operacionais

Todas as ferramentas validam argumentos com Zod na fronteira (FR-006) e retornam JSON serializável (string) para o agente. Erros previsíveis são classes de domínio traduzidas em observação de erro no trace.

## list_alerts

Lista alertas do catálogo, com filtro opcional por status.

```typescript
// Input (Zod)
z.object({
  status: z.enum(["firing", "resolved"]).optional(),
})

// Output: JSON
{ "alerts": [{ "id": 1, "service": "api-gateway", "title": "...", "status": "firing" }] }
```

Erros: `ValidationError` (status fora do enum).

## open_incident

Abre um incidente vinculado a um serviço existente.

```typescript
// Input (Zod)
z.object({
  title: z.string().min(1).max(200),
  service: z.string().min(1),           // nome do serviço (chave natural)
  severity: z.enum(["low", "medium", "high", "critical"]),
})

// Output: JSON
{ "incident": { "id": 7, "title": "...", "service": "billing", "severity": "high", "status": "open" } }
```

Erros: `ValidationError` (schema), `NotFoundError` (serviço inexistente).

## resolve_incident

Marca um incidente como resolvido. Idempotente: resolver um incidente já resolvido retorna o estado atual sem erro.

```typescript
// Input (Zod)
z.object({
  id: z.number().int().positive(),
})

// Output: JSON
{ "incident": { "id": 7, "status": "resolved", "resolvedAt": "2026-09-04T..." } }
```

Erros: `ValidationError` (id malformado), `NotFoundError` (id inexistente).
