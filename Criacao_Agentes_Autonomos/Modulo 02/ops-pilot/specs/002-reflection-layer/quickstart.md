# Quickstart: Camada de Reflection do OpsPilot

Guia prático de validação ponta a ponta da camada de reflexão. Contratos detalhados: [contracts/](contracts/), entidades: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS.
- Variáveis de ambiente configuradas no `.env` (`OPENROUTER_API_KEY` e `OPENROUTER_MODEL`).

## Cenário 1 — Testes Unitários e Determinísticos de Reflection (sem rede)

Executar a suite de testes automatizados com fakes in-memory:

```bash
npm run test
```

**Esperado**: Testes de `reflection.test.ts` cobrindo:
1. Aprovação direta na primeira rodada (1 crítica registrada, sem reexecução).
2. Reprovação na primeira rodada e correção bem-sucedida na segunda rodada com injeção de feedback.
3. Encerramento por limite quando `maxReflections` é atingido.
4. Acumulação precisa de métricas (`llmCalls` e `latencyMs`).

## Cenário 2 — Execução da Arena com `reflect:react`

Executar uma consulta operacional usando a estratégia ReAct com reflexão:

```bash
npm run arena -- "quais alertas estão disparando agora? abra um incidente para o alerta de billing" --strategies reflect:react
```

**Esperado**:
- Bloco `=== reflect:react ===`.
- Trace contendo eventos de ação, observação e ao menos um evento `[critique]`.
- Métricas consolidadas com a soma das chamadas da base e do crítico.

## Cenário 3 — Comparação na Arena: Base vs. Refletido

Comparar lado a lado o comportamento da estratégia base e da versão refletida para o mesmo comando:

```bash
npm run arena -- "liste os alertas em disparo e abra incidentes médios para api-gateway e billing" --strategies react,reflect:react,plan-and-execute,reflect:plan-and-execute
```

**Esperado**:
- 4 blocos distintos executados sobre o mesmo input.
- Versões `reflect:*` exibem evento `[critique]` antes do `[answer]` final.
- `typecheck` e `test` permanecem verdes.
