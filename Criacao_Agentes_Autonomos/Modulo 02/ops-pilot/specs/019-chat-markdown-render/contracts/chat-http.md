# Contract: Chat HTTP (delta)

**Date**: 2026-09-29 | **Spec**: [spec.md](../spec.md)

**Sem alteração.** O contrato completo permanece em [016 chat-http](../016-war-room-web/contracts/chat-http.md).

| Aspecto | Decisão |
| --- | --- |
| `POST /chat` corpo | inalterado |
| Resposta `200` | `answer` continua `string`; pode conter Markdown opaco ao servidor |
| Campos novos | nenhum |
| Content-Type / CORS | inalterados |

A formatação Markdown é responsabilidade exclusiva do cliente `web/`.
