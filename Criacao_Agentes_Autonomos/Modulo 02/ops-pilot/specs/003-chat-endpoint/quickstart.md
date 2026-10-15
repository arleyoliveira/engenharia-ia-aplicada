# Quickstart: Endpoint de Chat Operacional

Validação do endpoint definido em [contracts/chat-http.md](contracts/chat-http.md). Tipos e fluxos: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS.
- Dependências instaladas.
- Para execução contra estratégias reais, ambiente do modelo configurado. A suíte de integração não depende de credenciais nem de rede externa.

## Cenário 1 - Teste de integração determinístico

```bash
npm run test
```

**Esperado**: a suíte de chat inicia uma aplicação injetada com registry fake e valida `200`, defaults de `strategy`/`reflect`, `400` com `issues`, `422` para estratégia desconhecida e `504` usando timeout configurável de teste, sem LLM nem rede externa.

## Cenário 2 - Solicitação válida ao servidor local

```bash
npm run dev
curl -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Quais alertas estão disparando?"}'
```

**Esperado**: `200` com `answer`, `trace` e `metrics`; a estratégia padrão é `react`.

## Cenário 3 - Estratégia e reflexão explícitas

```bash
curl -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Resuma o plantão.","strategy":"plan-and-execute","reflect":true}'
```

**Esperado**: `200` e trace que contém os eventos da estratégia e avaliações `critique` da reflexão.

## Cenário 4 - Falhas contratuais

```bash
curl -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":""}'

curl -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"status","strategy":"inexistente"}'
```

**Esperado**: o primeiro caso retorna `400` com `issues`; o segundo retorna `422` com `UNKNOWN_STRATEGY`.