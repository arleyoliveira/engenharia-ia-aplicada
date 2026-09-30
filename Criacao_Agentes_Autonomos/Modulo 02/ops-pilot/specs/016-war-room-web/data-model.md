# Data Model: War room web

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Não há tabela nova. O `200` de decisão reutiliza `requests` e `trace_events` já persistidos pelo chat. O estado da sala vive na memória do navegador; URL e tema vivem no `localStorage`.

## Turno da sala

Um item do fio. A sala começa com a lista vazia (estado vazio da página, não um turno).

| Variante | Campos | Origem |
| --- | --- | --- |
| Mensagem do plantonista | `text` não vazio | envio local, antes do `POST` |
| Resposta | `requestId`, `conversationId?`, `answer`, `trace`, painel fechado | `200` |
| Cartão pendente | `requestId`, `conversationId?`, `summary`, `trace`, `choice?` | `202`; `choice` entra quando o plantonista decide |
| Erro | `status?`, `detail`, `retry` (o corpo que falhou) | rede ou `400`, `404`, `422`, `500`, `503`, `504` |

Regras:

- `summary` do cartão é `pendingAction.summary` aparado. Vazio ou ausente vira `"Ação aguardando decisão"`.
- `choice` é `approve` ou `deny`. Com `choice`, os botões não aparecem.
- `retry` de uma mensagem é `{ message, conversationId? }`. `retry` de uma decisão é `{ conversationId, decision }`.
- Um envio em voo bloqueia novo `POST`. O segundo clique em Aprovar ou Negar não cria outro item nem outro pedido.

## Ação pendente (corpo do 202)

Contrato consumido pela sala. Este servidor não produz `202`.

| Campo | Regra |
| --- | --- |
| `requestId` | string; se faltar, o metadado mostra vazio |
| `conversationId` | string; se faltar, a decisão não tem id e o próximo envio de mensagem não reutiliza conversa |
| `pendingAction.summary` | string; ver fallback acima |
| `trace` | array de eventos no formato já usado pelo `200`; ausente vale `[]` |

## Decisão

| Campo | Regra |
| --- | --- |
| `conversationId` | string com pelo menos um caractere depois do trim |
| `decision` | `approve` ou `deny` |

Sem `message`. Não convive com o corpo de mensagem no mesmo JSON.

Efeito no servidor, quando a conversa existe:

| `decision` | `answer` e `trace[0].content` | fala gravada na conversa |
| --- | --- | --- |
| `approve` | `Aprovado.` | usuário `Aprovar`, assistente `Aprovado.` |
| `deny` | `Negado.` | usuário `Negar`, assistente `Negado.` |

`trace[0]` é `{ type: "answer", content, node: "decisao" }`. `metrics` é `{ llmCalls: 0, latencyMs: 0 }`. Conversa inexistente: `404`, sem linha em `requests`.

## Configuração da sala

| Chave | Valores | Padrão se ausente ou inválido |
| --- | --- | --- |
| `opspilot.apiBase` | URL absoluta `http` ou `https` | `http://localhost:3000` |
| `opspilot.theme` | `light`, `dark`, `system` | `system` |

A URL de chamada é `apiBase` sem barras finais, mais `/chat`.

## Evento de trace na tela

Entrada: um elemento do array `trace` (os tipos de `TraceEvent` já existentes). Saída: `type`, `node` opcional e linhas `rótulo: valor`.

| `type` | Linhas |
| --- | --- |
| `thought`, `observation`, `critique`, `summarize`, `answer` | `content` |
| `action` | `tool`, `args` (JSON) |
| `plan` | `steps` (uma linha por passo, em ordem) |
| `route` | `route`, `reason`, `override` (`sim` ou `não`) |
| `fallback` | `from`, `to` |
| outro | uma linha com o JSON do evento |

`node` presente e não vazio aparece como metadado, não como campo do tipo.

## Transições do cartão

1. `202` cria cartão sem `choice`.
2. Aprovar ou Negar grava `choice` e envia a decisão.
3. `200` seguinte acrescenta uma resposta. Outro `202` acrescenta outro cartão. Erro acrescenta um erro com `retry` da decisão. O cartão anterior permanece com `choice`.
