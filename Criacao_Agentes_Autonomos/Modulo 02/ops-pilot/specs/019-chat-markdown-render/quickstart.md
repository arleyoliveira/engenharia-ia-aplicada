# Quickstart: Respostas em Markdown na war room

**Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

Validação sem rede externa nos testes. Contratos: [answer-markdown-ui.md](contracts/answer-markdown-ui.md), [chat-http.md](contracts/chat-http.md). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22
- `npm install` na raiz e `npm install --prefix web` (inclui dependências Markdown após implementação)

## Suíte

```bash
npm run typecheck
npm run test
```

Foco desta feature:

```bash
npm test --prefix web -- AnswerBody
npm test --prefix web -- WarRoom
npm test --prefix web -- answer-markdown
```

(Ajuste o filtro Vitest aos arquivos de teste criados em `web/src/`.)

## O que a suíte prova

1. **Estrutura.** Resposta fake com cabeçalho, lista e código mostra hierarquia reconhecível no balão do assistente.
2. **Prosa.** `answer` sem Markdown permanece legível; turno do usuário não interpreta Markdown.
3. **Segurança.** `answer` com script/HTML malicioso não deixa `script` executável no DOM renderizado; link `https` abre de forma segura.
4. **Regressão.** "ver raciocínio", envio, cartão `202`, engrenagem e retry continuam verdes nos testes existentes de `WarRoom`.
5. **API.** Nenhum teste novo obrigatório em `src/http/server.test.ts` para esta feature; contrato HTTP inalterado.

## Ensaio manual (opcional)

Com API e sala no ar ([016 quickstart](../016-war-room-web/quickstart.md)):

1. Peça ao modelo uma resposta com passos numerados ou lista de alertas.
2. Confirme títulos, listas e trechos `code` formatados no balão.
3. Alterne tema claro/escuro na engrenagem e verifique contraste de código e links.
