# Data Model: Status de provedores externos

**Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

Não há entidades persistidas. O modelo é transitório (consulta → validação → resumo).

## Tipos de domínio (TypeScript)

### ProviderId

```text
ProviderId = "github" | "cloudflare"
```

Default na tool: `"github"`.

### ProviderStatusPayload (contrato externo mínimo)

```text
ProviderStatusPayload = {
  status: {
    indicator: string;    // ex.: "none" | "minor" | "major" | "critical" (aberto)
    description: string;  // ex.: "All Systems Operational"
  }
}
```

Campos adicionais da Statuspage (`page`, `components`, `incidents`, …) são ignorados.

### ProviderStatusResult

```text
ProviderStatusResult =
  | { ok: true; line: string }   // "{provider}: {indicator} — {description}"
  | { ok: false; error: string } // mensagem legível para observação
```

A tool LangChain serializa sempre como `string` (linha de sucesso ou texto de erro). O tipo `ProviderStatusResult` é interno ao serviço.

## Mapa de provedores

| ProviderId   | URL pública |
|--------------|-------------|
| `github`     | `https://www.githubstatus.com/api/v2/status.json` |
| `cloudflare` | `https://www.cloudflarestatus.com/api/v2/status.json` |

## Fluxo de estados da consulta

```text
start
  → attempt_1 (timeout 5s)
      → success + Zod ok → compact_line
      → 4xx | Zod fail | JSON inválido → error_string (sem retry)
      → network | timeout | 5xx → attempt_2 (timeout 5s)
          → success + Zod ok → compact_line
          → qualquer falha → error_string
```

## Regras de validação

- `provider`: enum fechado; default `github`.
- Payload: `status.indicator` e `status.description` strings não vazias.
- Retry: no máximo 2 tentativas totais; segunda só após rede/timeout/5xx.
- Sem persistência de histórico de status.
