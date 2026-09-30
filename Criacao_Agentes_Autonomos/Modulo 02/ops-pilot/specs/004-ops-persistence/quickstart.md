# Quickstart: Persistência Real de Operações (SQLite)

Este guia rápido demonstra como utilizar a persistência SQLite embarcada e as novas ferramentas de operações do OpsPilot.

## 1. Configuração do Ambiente

Por padrão, o OpsPilot utiliza o caminho local `./data/opspilot.db`. Você pode customizar a localização do banco através da variável de ambiente `OPSPILOT_DB`:

```bash
export OPSPILOT_DB="./data/opspilot.db"
```

Para testes automatizados ou execuções voláteis, utilize `:memory:`.

## 2. Inicialização e Seed do Catálogo

O seed do catálogo instala o cenário do Mercadinho de forma idempotente (5 serviços, 6 alertas e 3 runbooks):

```bash
npx tsx src/scripts/seed.ts
```

Output esperado:
```text
5 services, 6 alerts (3 firing, 3 resolved), 3 runbooks.
```

Executar o seed novamente não duplica registros.

## 3. Ferramentas Operacionais

O OpsPilot expõe 5 ferramentas operacionais:

1. `list_alerts`: Consulta alertas de monitoramento (`firing`, `resolved` ou todos).
2. `open_incident`: Abre novo incidente formal com severidade (`low`, `medium`, `high`, `critical`).
3. `resolve_incident`: Marca incidente como resolvido pelo `id`.
4. `list_incidents`: Lista incidentes operacionais com filtro de status (`open` por padrão, `resolved`, `all`).
5. `consultar_runbook`: Obtém o procedimento operacional de resposta para um serviço (`checkout`, `payments`, `auth`).

## 4. Testes e Validação

Execute a suíte de testes determinísticos em memória:

```bash
npm run typecheck
npm run test
```
