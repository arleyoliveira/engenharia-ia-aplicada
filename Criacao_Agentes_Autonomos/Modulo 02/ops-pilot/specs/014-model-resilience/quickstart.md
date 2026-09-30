# Quickstart: Resiliência de modelo

**Date**: 2026-09-23 | **Spec**: [spec.md](spec.md)

Validação sem rede. Contratos: [model-factory.md](contracts/model-factory.md), [chat-http.md](contracts/chat-http.md). Modelo: [data-model.md](data-model.md).

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

## O que a suíte prova

1. **Retry sem reserva chamada.** Primário fake falha duas vezes e responde na terceira. A reserva não roda. Não há evento `fallback`.
2. **Reserva atende.** Primário falha três vezes; reserva responde. Um evento `fallback` com `from` / `to`. A reserva não é chamada antes da terceira falha.
3. **Nada responde.** Primário e reserva falham → `ModelUnavailableError`. Sem reserva configurada, três falhas do primário → o mesmo erro, e a reserva não existe.
4. **HTTP.** Esse erro no fluxo de chat → `503`, `error.code` `MODEL_UNAVAILABLE`, sem métricas. Timeout continua `504`.
5. **Turn `200`.** Coletor vazio → `metrics.fallbacks` é `0` e o trace não ganha `fallback`. Coletor com N registros → N eventos no fim do trace e `metrics.fallbacks` N.
6. **Formatação.** `formatTrace` imprime o evento `fallback` sem ler `content`.

## Ensaio manual (opcional, com rede)

Só depois da suíte verde. No `.env` local (não versionado):

```text
OPENROUTER_MODEL=<modelo primário>
OPENROUTER_MODEL_FALLBACK=<outro modelo>
```

Subir o servidor (`npm run dev`) e mandar um `POST /chat`. Com os dois modelos sãos, a resposta `200` traz `metrics.fallbacks` `0`. Para ver `503` ou um `fallback`, é preciso um primário inválido ou indisponível — isso gasta cota e não faz parte do gate.

## Fora deste guia

Não há migração, seed novo nem mudança de body do `POST /chat`.
