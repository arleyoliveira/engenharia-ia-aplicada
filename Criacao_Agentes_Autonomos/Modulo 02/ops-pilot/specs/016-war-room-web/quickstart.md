# Quickstart: War room web

**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

Validação sem modelo e sem rede externa. Contratos: [chat-http.md](contracts/chat-http.md), [war-room-ui.md](contracts/war-room-ui.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22
- Dependências da raiz (`npm install`) e de `web/` (`npm install --prefix web`)

## Suíte

```bash
npm run typecheck
npm run test
```

Os dois comandos terminam com exit 0. O typecheck cobre `src/` e `web/`. O teste cobre o `node:test` atual e o Vitest de `web/`.

Foco desta feature:

```bash
npm run test -- src/http/server.test.ts
npm test --prefix web
```

## O que a suíte prova

1. **CORS.** `OPTIONS /chat` com `Origin` e preflight de `POST` JSON responde `204` e devolve essa origem, `POST` e `Content-Type`. Um `POST /chat` com `Origin` deixa o cliente ler o JSON. Sem `Origin`, a resposta segue como hoje.
2. **Decisão.** `{ conversationId, decision: "approve" }` numa conversa existente responde `200` com `Aprovado.`, trace de um `answer` e `requestId` no corpo e no header. `deny` responde `Negado.`. Não há chamada de estratégia. `decision` inválida ou misturada com `message` é `400`. Conversa inexistente é `404` e não grava pedido.
3. **Fio.** Na sala, um `200` fake aparece sem recarregar a página. O segundo envio manda o `conversationId` do primeiro.
4. **Raciocínio.** "ver raciocínio" lista os eventos na ordem, com os campos do tipo. Trace vazio diz que não há eventos. Fechar o painel não chama o chat de novo.
5. **Cartão.** Um `202` fake mostra Aprovar e Negar e não é erro. Cada botão manda um único `POST` com `decision` e sem `message`. O fio guarda a escolha.
6. **Engrenagem.** A URL confirmada sobrevive a uma nova montagem da sala e é a base do `POST` seguinte, com uma só `/chat`. URL vazia ou não absoluta não substitui a última válida.
7. **Erro.** Falha de `fetch` ou status de erro mostra o que falhou e “Tentar de novo”, e o fio anterior continua. Mensagem em branco não gera `POST`.

## Ensaio manual (opcional)

Com a suíte verde:

```bash
npm run dev
npm run dev --prefix web
```

A API fica em `http://localhost:3000`. A sala abre em `http://localhost:5173/opspilot/`. A engrenagem já aponta para `http://localhost:3000`. Enviar uma mensagem usa o modelo configurado; isso não faz parte do gate. O cartão de `202` não aparece contra este servidor: ele não interrompe o turno.
