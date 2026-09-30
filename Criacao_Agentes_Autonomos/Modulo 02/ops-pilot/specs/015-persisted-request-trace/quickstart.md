# Quickstart: Trace persistido e logs JSON

**Date**: 2026-09-24 | **Spec**: [spec.md](spec.md)

Validação sem rede. Contratos: [chat-http.md](contracts/chat-http.md), [requests-http.md](contracts/requests-http.md), [request-log.md](contracts/request-log.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22
- Dependências instaladas (`npm install`)
- Não é necessário `.env` nem OpenRouter para a suíte

## Suíte

```bash
npm run typecheck
npm run test
```

Os dois comandos terminam com exit 0.

Foco desta feature:

```bash
npm run test -- src/obs/logger.test.ts src/store/request-trace-store.test.ts src/http/server.test.ts
```

## O que a suíte prova

1. **Id na resposta.** `POST /chat` `200` e um erro (`400` ou JSON inválido) trazem o mesmo `requestId` no corpo e em `X-Request-Id`. Duas chamadas geram ids diferentes. Um `X-Request-Id` de entrada não é ecoado. Campo extra no corpo continua `400`.
2. **Persistência.** O `200` deixa uma linha em `requests` com as métricas da resposta e N linhas em `trace_events` com `node` e payload iguais ao `trace`, na mesma ordem. Trace vazio grava o pedido e zero eventos. Erro de chat não grava.
3. **Atomicidade.** Payload que não serializa não deixa `requests` órfão. `save` com id já commitado falha e o registro anterior continua íntegro. No HTTP, store que lança não produz `200`; o corpo é `500` com o `requestId`, e o GET desse id é `404`.
4. **Log.** N eventos produzem N linhas `kind: "trace"` e uma `kind: "request"`. Cada linha é um JSON. O texto do payload não aparece. Erro produz só a linha de resumo, com o status da resposta.
5. **Consulta.** `GET /requests/:id` do turno gravado devolve métricas e trace iguais ao `200`. UUID desconhecido é `404` `NOT_FOUND` e não insere linha. Id vazio ou não-UUID é `400`.

## Ensaio manual (opcional)

Com a suíte verde, subir o servidor (`npm run dev`) e mandar um `POST /chat`. A resposta traz `requestId` e o header `X-Request-Id`. O stdout do processo mostra uma linha JSON por evento de trace e uma linha de resumo, sem o texto da mensagem. `GET /requests/{requestId}` devolve o mesmo trace. Isso usa o modelo configurado e não faz parte do gate.
