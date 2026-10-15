# Contract: `check_provider_status`

**Date**: 2026-09-17 | **Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Ferramenta operacional do agente. Argumentos validados com Zod. Retorno **sempre** `string` (sucesso compacto ou erro legível). Nunca lança exceção para o runtime do agente.

## Input (Zod)

```typescript
z.object({
  provider: z
    .enum(["github", "cloudflare"])
    .default("github")
    .describe(
      "Provedor externo cuja status page pública será consultada. Use 'github' (padrão) ou 'cloudflare'.",
    ),
})
```

## Descrição da tool (orientação de uso)

Deve cobrir, no mínimo:

- **O que faz**: consulta a status page pública do provedor (sem autenticação).
- **Quando usar**: suspeita de problema externo; pergunta “é o nosso ou do provedor?”; dependência fora do ar.
- **Quando não usar**: listar alertas/incidentes internos do OpsPilot; abrir/resolver incidente.
- **Efeitos**: somente leitura HTTP externa; sem mutação local.
- **Retorno**: uma linha `provider: indicator — description`, ou mensagem de erro legível.

## Output

### Sucesso

```text
github: none — All Systems Operational
```

```text
cloudflare: major — Cloudflare is investigating elevated error rates
```

### Falha (observação)

Exemplos (texto exato pode variar, desde que legível):

```text
check_provider_status failed: timeout consulting github status page
```

```text
check_provider_status failed: HTTP 503 from cloudflare after retry
```

```text
check_provider_status failed: invalid status payload from github
```

## Dependências injetáveis (testes)

```typescript
checkProviderStatus({
  provider: "github",
  fetchImpl?: typeof fetch, // default: globalThis.fetch
})
```

## Fontes HTTP

| provider     | method | URL |
|--------------|--------|-----|
| `github`     | GET    | `https://www.githubstatus.com/api/v2/status.json` |
| `cloudflare` | GET    | `https://www.cloudflarestatus.com/api/v2/status.json` |

Sem headers de autenticação. Timeout por tentativa: 5s (`AbortSignal.timeout(5000)`).

## Resiliência

| Condição | Ação |
|----------|------|
| Rede / abort timeout / HTTP 5xx | 1 retry (segunda tentativa completa) |
| HTTP 4xx | erro legível, sem retry |
| JSON inválido / Zod fail | erro legível, sem retry |
| Sucesso na 2ª tentativa | linha compacta normal |

## Erros de argumento

`provider` fora do enum: rejeição Zod na fronteira da tool (antes de qualquer fetch).
