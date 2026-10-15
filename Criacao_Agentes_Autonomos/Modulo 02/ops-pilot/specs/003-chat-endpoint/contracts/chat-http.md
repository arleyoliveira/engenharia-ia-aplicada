# Contract: `POST /chat`

**Date**: 2026-09-14 | **Spec**: [spec.md](../spec.md)

## Request

```http
POST /chat
Content-Type: application/json
```

```json
{
  "message": "Liste os alertas em firing e recomende a primeira ação.",
  "strategy": "react",
  "reflect": false
}
```

| Campo | Obrigatório | Default | Descrição |
|---|---:|---|---|
| `message` | Sim | - | Solicitação textual, não vazia após trim. |
| `strategy` | Não | `react` | Nome registrado da estratégia. |
| `reflect` | Não | `false` | Ativa a camada de reflexão sobre a estratégia selecionada. |

## Responses

### 200 OK

```json
{
  "answer": "Há três alertas em firing; priorize a fila de pagamentos.",
  "trace": [{ "type": "observation", "content": "..." }],
  "metrics": { "llmCalls": 2, "latencyMs": 184 }
}
```

### 400 Bad Request

```json
{
  "issues": [
    {
      "code": "invalid_type",
      "path": ["message"],
      "message": "..."
    }
  ]
}
```

### 422 Unprocessable Content

```json
{
  "error": {
    "code": "UNKNOWN_STRATEGY",
    "message": "Estratégia desconhecida: \"foo\"."
  }
}
```

### 504 Gateway Timeout

```json
{
  "error": {
    "code": "CHAT_TIMEOUT",
    "message": "A execução excedeu o limite de 180 segundos."
  }
}
```

## Registry Contract

```typescript
export interface StrategyRegistry {
  resolve(name: string, reflect: boolean): ReasoningStrategy | undefined;
  names(): readonly string[];
}
```

O registry padrão reconhece `react` e `plan-and-execute`. Para `reflect: true`, aplica `withReflection` à instância base selecionada.