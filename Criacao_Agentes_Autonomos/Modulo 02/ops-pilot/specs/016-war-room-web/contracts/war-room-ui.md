# Contract: War room (interface)

**Date**: 2026-09-28 | **Spec**: [spec.md](../spec.md) | **Model**: [data-model.md](../data-model.md)

Página única servida em `/opspilot/`. Título principal: `War room`. Rótulos em português.

## Regiões

| Região | Conteúdo | Ação primária |
| --- | --- | --- |
| Sala vazia | O que falta (“Nenhuma mensagem ainda”) e por que a sala está ociosa | Enviar a primeira mensagem |
| Fio | Turnos na ordem em que ocorreram | Enviar, no compositor |
| Cartão | Resumo da ação pendente e `requestId` em metadado | Aprovar. Negar é secundária |
| Engrenagem | URL da API e tema | Confirmar a URL |

O botão da engrenagem tem nome acessível `Configurar URL da API`. O campo da URL tem rótulo visível `URL da API`. "ver raciocínio" reflete `aria-expanded`.

## Chamadas

Base padrão `http://localhost:3000`, ou `opspilot.apiBase` se for uma URL `http`/`https` absoluta. Pedido: `POST {base}/chat` com `Content-Type: application/json`.

| Ação | Corpo |
| --- | --- |
| Enviar texto | `{ "message": "<texto>", "conversationId": "<se já houver>" }` |
| Aprovar | `{ "conversationId": "<id>", "decision": "approve" }` |
| Negar | `{ "conversationId": "<id>", "decision": "deny" }` |

Texto só com espaços não gera `POST`; o erro fica no campo e o foco volta para ele.

## Leitura da resposta

| Status | Efeito no fio |
| --- | --- |
| `200` | Resposta com `answer`, `requestId` e "ver raciocínio" |
| `202` | Cartão. Não é erro |
| `400`, `404`, `422`, `500`, `503`, `504` | Erro com o que falhou e “Tentar de novo” |
| rede, CORS bloqueado, JSON ilegível | Erro de alcance da API, com “Tentar de novo” |

Enquanto o pedido está em voo, o estado de espera é visível e o envio não dispara outro `POST`. “Tentar de novo” reenvia o corpo guardado no erro.

## Trace

Painel fechado ao chegar o turno. Aberto, lista os eventos na ordem do array, com as linhas de [data-model.md](../data-model.md). Trace vazio mostra que não há eventos. Fechar não chama a API.

## Persistência local

| Chave | Quando grava |
| --- | --- |
| `opspilot.apiBase` | URL confirmada e válida. Inválida não substitui a anterior |
| `opspilot.theme` | `light`, `dark` ou `system` |

Tema `system` acompanha `prefers-color-scheme`. Claro e escuro usam os tokens `--surface`, `--text`, `--text-muted`, `--border`, `--accent`, `--danger`. Espaçamento só nas variáveis da escala 4, 8, 12, 16, 24, 32, 48.
