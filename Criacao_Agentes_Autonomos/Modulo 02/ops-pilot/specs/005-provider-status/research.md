# Research: Status de provedores externos

**Date**: 2026-09-17 | **Feature**: [spec.md](spec.md)

Nenhuma pendência de esclarecimento no Technical Context. Decisões abaixo alinham a spec, a constituição e o padrão atual de tools do OpsPilot.

## R1. Módulo de serviço + tool fina

- **Decision**: Implementar a consulta em `src/services/provider-status.ts` (`checkProviderStatus({ provider, fetchImpl? })`) e registrar a tool LangChain em `src/agents/tools.ts`, que apenas valida args Zod, chama o serviço e devolve string.
- **Rationale**: Mantém IO de rede na camada de serviço e a tool como borda do agente (camadas explícitas). Facilita testes unitários do serviço sem montar o wrapper LangChain.
- **Alternatives considered**: (a) toda a lógica inline em `tools.ts`: mistura responsabilidades e infla o arquivo; (b) adapter HTTP Express: fora de escopo — a feature é tool de agente, não endpoint.

## R2. Fetch injetável com default global

- **Decision**: Tipar `fetchImpl` como `typeof fetch` (ou subset compatível). Em produção, default `globalThis.fetch`. Em testes, injetar fake que ignora URL real e controla status/corpo/abort.
- **Rationale**: Atende FR-010/FR-011 e evita mock global frágil de `global.fetch`.
- **Alternatives considered**: (a) stub de `globalThis.fetch`: polui estado entre testes; (b) HTTP real nos testes: viola SC-004 e a constituição de testes determinísticos.

## R3. Timeout e retry

- **Decision**: Cada tentativa usa `signal: AbortSignal.timeout(5000)`. Retry **exatamente uma vez** somente se a falha for (i) erro de rede/`TypeError`/abort por timeout **ou** (ii) HTTP status ≥ 500. Não retentar em 4xx nem em payload inválido após HTTP 200. Timeout conta como falha elegível a retry (uma nova tentativa completa com novo signal de 5s).
- **Rationale**: Spec exige 5s + uma nova tentativa em rede/5xx; retry em 4xx/validação desperdiçaria tempo sem benefício.
- **Alternatives considered**: (a) não retentar timeout: pior UX em blip transitório; (b) backoff exponencial: overkill para tool de plantão; (c) retentar 4xx: status pages raramente se recuperam de 404 com retry imediato.

## R4. Validação Zod do payload Statuspage

- **Decision**: Schema mínimo:

  ```ts
  z.object({
    status: z.object({
      indicator: z.string().min(1),
      description: z.string().min(1),
    }),
  })
  ```

  Ignorar demais campos (`page`, `components`, etc.).
- **Rationale**: Espelha o contrato Statuspage v2 usado por GitHub/Cloudflare e evita acoplamento a campos voláteis.
- **Alternatives considered**: (a) tipar `indicator` como enum (`none|minor|major|critical`): mais rígido, mas status pages já documentam esses valores — ainda assim string aberta é mais resiliente a novos indicadores; (b) aceitar qualquer JSON: viola FR-008.

## R5. Formato de retorno e política de erro da tool

- **Decision**: Sucesso → uma linha: `{provider}: {indicator} — {description}` (ex.: `github: none — All Systems Operational`). Falha final → string legível prefixada (ex.: `check_provider_status failed: timeout after retry`). A tool **sempre** `return` string; `try/catch` engole qualquer throw do serviço e converte em string (FR-009). Argumento `provider` inválido: Zod/LangChain rejeita na fronteira antes do fetch; se chegar ao handler, devolver string de erro sem rede.
- **Rationale**: Compacto para o contexto do LLM; erro como observação mantém o loop ReAct vivo.
- **Alternatives considered**: (a) JSON estruturado no sucesso: mais tokens e menos legível no trace; (b) lançar `DomainError` para fora: quebra o contrato “erro é observação” da spec.

## R6. Integração no conjunto de tools

- **Decision**: Incluir `check_provider_status` no array de `createOpsTools`. Aceitar opção opcional `{ fetchImpl?: typeof fetch }` (ou segundo parâmetro de deps) para propagar o fake fetch nos testes da tool. Default de `provider` = `"github"` via Zod `.default("github")`.
- **Rationale**: Mesma composição usada por react/plan-and-execute/`createDefaultOpsTools`.
- **Alternatives considered**: (a) tool separada registrada só no chat: divergiria da arena/bench; (b) hardcode `fetch` sem injeção: impede SC-004.

## R7. URLs fixas (sem config)

- **Decision**: Mapa constante no serviço:

  | provider    | URL |
  |-------------|-----|
  | `github`    | `https://www.githubstatus.com/api/v2/status.json` |
  | `cloudflare`| `https://www.cloudflarestatus.com/api/v2/status.json` |

  Sem variáveis de ambiente.
- **Rationale**: Spec/assumptions; evita segredo e config desnecessária.
- **Alternatives considered**: (a) URLs via env: flexível mas fora de escopo; (b) descoberta dinâmica: complexidade injustificada.
