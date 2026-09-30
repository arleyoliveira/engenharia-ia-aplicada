# Quickstart: Status de provedores externos

Validação da tool definida em [contracts/check-provider-status.md](contracts/check-provider-status.md). Modelo transitório: [data-model.md](data-model.md).

## Pré-requisitos

- Node.js 22 LTS e dependências instaladas (`npm install`).
- Credenciais do modelo **não** são necessárias para a suíte de testes desta feature.
- Para exercício manual via chat/arena, configure `OPENROUTER_*` como de costume.

## Cenário 1 - Testes determinísticos (sem rede)

```bash
npm run test -- src/services/provider-status.test.ts
npm run test -- src/agents/tools.test.ts
```

**Esperado**:

- Sucesso com fake fetch → linha `github: … — …` (ou cloudflare).
- Timeout / payload inválido → string de erro legível; nenhuma exceção não capturada.
- Contagem de chamadas ao fake fetch confirma **uma** retentativa em 5xx/rede.
- Nenhum acesso às URLs reais de statuspage.

## Cenário 2 - Typecheck

```bash
npm run typecheck
```

**Esperado**: sem erros; tipos de `fetchImpl` e schema Zod consistentes.

## Cenário 3 - Exercício manual via chat (opcional, com rede)

Com o servidor em execução (`npm run dev`):

```bash
curl -sS -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"O checkout está lento; é problema nosso ou do Cloudflare? Verifique o status do provedor cloudflare."}'
```

**Esperado**: o trace inclui uma ação `check_provider_status` (provider `cloudflare` ou default `github` se o modelo omitir) e a resposta cita o indicador/descrição ou o erro legível se a status page falhar.
