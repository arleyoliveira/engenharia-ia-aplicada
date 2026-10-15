# Quickstart: Modo equipe

Validação dos contratos em [contracts/](contracts/). Modelo: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e `npm install` na raiz e em `web/` se os módulos de `web/` ainda não estiverem instalados.
- Credencial de modelo não é necessária. Supervisor, papéis e roteador dos cenários abaixo são fakes.

## Cenário 1 - Ciclo da equipe sem rede (obrigatório)

```bash
node --import tsx --test src/team/blackboard.test.ts src/team/allowlist.test.ts src/team/team-graph.test.ts
```

**Esperado**:

- Supervisor fake em `analista` → `planejador` → `executor` → `fim`: cada papel roda uma vez, o quadro acumula achados, plano e ações, a `answer` é o `brief` de `fim`.
- O analista recebe só as quatro ferramentas de leitura; o planejador recebe lista vazia; o executor recebe só `open_incident` e `resolve_incident`. `forget_preference` não entra em nenhuma.
- Sem handoff `executor`, a tool de incidente não é invocada.
- Pedido de ferramenta fora da allowlist não chama `invoke` da lista original.
- Oito handoffs de papel: exatamente 8 eventos `handoff`, o oitavo papel roda, a `answer` é `Execução interrompida: limite de iterações (8) atingido.`
- `fim` no oitavo handoff: a `answer` é o `brief`.
- `next` inválido ou `brief` em branco lança erro de saída de modelo e não roda papel.
- Sem rede.

## Cenário 2 - Rota no grafo de produção (obrigatório)

```bash
node --import tsx --test src/graph/production-Graph.test.ts
```

**Esperado**:

- `PRODUCTION_ROUTES` inclui `team` e conserva `react`, `planExecute`, `reflect`.
- O prompt do roteador contém a linha `team`.
- Roteador fake devolvendo `team`: só essa strategy corre; as outras três ficam em zero; o evento `route` tem `override: false`.
- `strategy: "team"` não chama o roteador e marca `override: true`.
- `reflect: true` com rota `team` vinda do modelo continua erro de saída. `strategy: "team"` com `reflect: true` não emite `critique`.
- Eventos que o modo já carimbou (`supervisor`, `analista`, `planejador`, `executor`) não são reescritos para `team`.

## Cenário 3 - Trace textual e painel (obrigatório)

```bash
node --import tsx --test src/agents/trace.test.ts
npm test --prefix web -- src/model/trace-lines.test.ts src/ui/WarRoom.test.tsx
```

**Esperado**:

- `formatTrace` de um `handoff` é `[handoff] analista <brief>`. As linhas antigas de `route`, `action` e `plan` permanecem.
- `presentTrace` mostra `next` e `brief`. Os tipos já cobertos continuam com os mesmos rótulos.
- "ver raciocínio" num `200` fake com `handoff` exibe esses campos na ordem do `trace`. Fechar o painel não chama `fetch` de novo.

## Cenário 4 - HTTP (obrigatório)

```bash
node --import tsx --test src/http/server.test.ts
```

**Esperado**:

- `strategy: "team"`: `200`, evento `route` com `override: true`, o `routeModel` fake não é chamado.
- `strategy: "missing"`: `422` `UNKNOWN_STRATEGY`.
- `strategy` omitida com roteador fake em `react` continua `200` e não dispara o modo equipe.

## Cenário 5 - Suíte (obrigatório)

```bash
npm run typecheck
npm run test
```

**Esperado**: os dois comandos terminam com sucesso.
