# Quickstart: Grafo unificado de produção

Validação dos contratos em [contracts/](contracts/). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e `npm install`.
- Credenciais de modelo não são necessárias para os cenários obrigatórios (roteador e estratégias fakes).

## Cenário 1 - Grafo sem rede (obrigatório)

```bash
npm run test -- src/agents/production-graph.test.ts
```

**Esperado**:

- Sem override, `visited` é `contexto`, `roteador`, a rota injetada, `resposta`.
- Para cada uma das três rotas, só aquela estratégia tem `run` chamado.
- A mensagem `system` recebida pelo `routeModel` contém as três linhas da tabela (`react`, `plan-and-execute`, `reflection` e o critério de cada uma).
- O trace tem um evento `route` com `route`, `reason`, `override: false` e `node: "roteador"`.
- Todo evento do trace tem `node`.
- Com `strategy` válida, `routeModel.invoke` não é chamado; `override: true` e `reason` igual a `estratégia informada pelo cliente`.
- Saída sem `route`/`reason` ou com rota fora do enum lança erro de saída de modelo e não chama estratégia.
- Sem rede.

## Cenário 2 - Formatação do evento `route` (obrigatório)

```bash
npm run test -- src/agents/trace.test.ts
```

**Esperado**:

- `[route] plan-and-execute override=true estratégia informada pelo cliente` (ou o par rota/override do caso).
- Linhas antigas de `thought`, `action`, `plan` e `answer` inalteradas.

## Cenário 3 - HTTP (obrigatório)

```bash
npm run test -- src/http/server.test.ts
```

**Esperado**:

- Corpo só com `message`: `200`, evento `route` com `override: false` (não assume `react` sem o fake do roteador devolver `react`).
- `strategy: "plan-and-execute"`: `200`, `override: true`, roteador fake não chamado.
- `strategy: "missing"`: `422` `UNKNOWN_STRATEGY`.
- `strategy: ""`: `400`.
- Timeout, `404` e `reflect` inválido continuam como antes.
- Sem rede.

## Cenário 4 - Regressão do turn

```bash
npm run test -- src/services/run-chat.test.ts
npm run typecheck && npm run test
```

**Esperado**:

- Histórico, resumo, recall e orçamento continuam valendo; o nó de estratégia recebe o contexto orçado.
- `summarize`, quando ocorre, tem `node: "contexto"` e vem antes do evento `route`.
- Suíte completa verde, sem rede.
