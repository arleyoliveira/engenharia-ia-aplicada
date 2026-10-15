# Data Model: Resiliência de modelo

**Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

Sem tabela nova. Estado só no turn (memória) e na configuração do processo.

## Modelo primário

| Campo | Regra |
|-------|--------|
| Identificador | `OPENROUTER_MODEL`, obrigatório, não vazio (já é `ConfigError`) |
| Chave | `OPENROUTER_API_KEY`, obrigatória |
| Base URL | `https://openrouter.ai/api/v1` |
| Temperatura | `0` |
| Tentativas por chamada | 3 (`stopAfterAttempt`) |

## Modelo reserva

| Campo | Regra |
|-------|--------|
| Identificador | `OPENROUTER_MODEL_FALLBACK` |
| Presente | trim diferente de `""` |
| Ausente | variável indefinida, `""` ou só espaços → sem reserva, sem `withFallbacks` |
| Chave, base URL, temperatura | iguais às do primário |
| Tentativas | 1, só depois das 3 falhas do primário |
| Igual ao primário | permitido; ainda assim conta como fallback se for quem responder |

## Fachada resiliente

Devolvida por `createModel()`. Não é o `ChatOpenAI` cru.

| Operação | Comportamento |
|----------|----------------|
| `invoke(input, options)` | Cadeia resiliente sobre o chat sem tools/schema |
| `bindTools(tools, kwargs)` | Mesmas tools no primário e na reserva; cadeia sobre os runnables já bound |
| `withStructuredOutput(schema, config)` | Mesmo schema/config nos dois; cadeia sobre os runnables estruturados |

Falha da cadeia inteira → `ModelUnavailableError`. Sucesso da reserva → um registro de fallback no coletor ativo.

## Evento de fallback

Acrescentado à união `TraceEvent`.

| Campo | Tipo | Regra |
|-------|------|--------|
| `type` | `"fallback"` | literal |
| `from` | string | identificador do primário no momento da chamada |
| `to` | string | identificador da reserva |
| `node` | string opcional | só se quem monta o trace já carimba nó; a fábrica não inventa nó |

Não tem `content`. `formatTrace` precisa de ramo próprio.

## Métrica `fallbacks`

Campo de `Metrics` no turn `200`.

| Campo | Tipo | Regra |
|-------|------|--------|
| `fallbacks` | inteiro ≥ 0 | número de eventos `fallback` daquele turn; sempre presente na resposta HTTP `200` |

## Coletor do turn

Lista em `AsyncLocalStorage`, aberta por `runChat` antes do sumarizador e fechada antes do aprendizado.

| Transição | Efeito |
|-----------|--------|
| Reserva responde e há coletor | append do evento |
| Reserva responde e não há coletor | resposta segue; nada é gravado |
| Cadeia lança `ModelUnavailableError` | turn aborta; coletor não vira resposta |
| Fim do turn com sucesso | `trace` ganha os eventos no final; `metrics.fallbacks = eventos.length` |

Fora do coletor: refletor de aprendizado.

## Erro de indisponibilidade

| Campo | Valor |
|-------|--------|
| Classe | `ModelUnavailableError` extends `DomainError` |
| `code` | `MODEL_UNAVAILABLE` |
| Mensagem | texto fixo legível, sem detalhe do provedor |
| HTTP | `503` `{ error: { code, message } }` |
| Outras bordas | `toBoundaryMessage` → falha, sem answer |

Não substitui `ConfigError`, `ModelOutputError`, `ChatTimeoutError`, `NotFoundError`.

## Fluxo por chamada de modelo

```text
primário tentativa 1..3
  └─ sucesso → fim (sem evento)
  └─ 3 falhas e sem reserva → ModelUnavailableError
  └─ 3 falhas e com reserva
        └─ reserva sucesso → evento fallback
        └─ reserva falha → ModelUnavailableError
```
