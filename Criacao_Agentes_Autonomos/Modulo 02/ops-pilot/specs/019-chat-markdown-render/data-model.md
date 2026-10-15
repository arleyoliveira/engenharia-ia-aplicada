# Data Model: Respostas em Markdown na war room

**Date**: 2026-09-29 | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Não há tabela, coluna ou campo HTTP novo. O modelo da sala ([016 data-model](../016-war-room-web/data-model.md)) permanece; esta feature acrescenta apenas uma **visão de apresentação** derivada em memória.

## Turno answer (inalterado na origem)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `kind` | `"answer"` | constante |
| `answer` | `string` | texto cru vindo do `200`; pode conter Markdown ou prosa |
| `requestId` | `string` | metadado abaixo do corpo formatado |
| `trace` | array | painel "ver raciocínio"; texto plano por evento |
| `traceOpen` | boolean | UI local |

Nenhum campo novo no turno. `applyOutcome` e `postChat` não mudam.

## Answer renderizada (visão derivada)

Projeção efêmera usada só na UI do balão do assistente.

| Entrada | Saída | Persistência |
| --- | --- | --- |
| `answer: string` | árvore React / DOM sanitizado dentro de `.answer-md` | nenhuma |

Regras de transformação:

| Regra | Detalhe |
| --- | --- |
| Escopo | Somente turnos `kind: "answer"`. Mensagens `user`, cartões `card`, erros `error` ignoram o pipeline |
| Subconjunto Markdown | Parágrafos; `#`–`###` (mapeados para `h2`–`h4`); ênfase; listas; links http(s); código inline e blocos |
| Sanitização | Sem script, handlers inline, HTML ativo arbitrário; trecho perigoso omitido ou inerte |
| Imagens | Sem fetch remoto; sem `<img>` com URL externa |
| Prosa simples | String sem marcadores → um ou mais parágrafos legíveis, sem erro |
| Markdown malformado | Melhor esforço; não aborta o fio nem o turno |

## Relação com outros textos da sala

| Região | Formato |
| --- | --- |
| Balão `answer` | Markdown renderizado (esta feature) |
| Balão `user` | texto literal em `<p class="bubble">` |
| `pendingAction.summary` (cartão) | texto plano |
| Linhas do trace | texto plano formatado por `trace-lines` |
| `requestId` | metadado `.meta`, texto plano |

## Estado e transições

Não há máquina de estados nova. Abrir ou fechar "ver raciocínio" não reparseia nem altera o DOM do corpo formatado além do re-render normal do React (mesma string `answer`).
