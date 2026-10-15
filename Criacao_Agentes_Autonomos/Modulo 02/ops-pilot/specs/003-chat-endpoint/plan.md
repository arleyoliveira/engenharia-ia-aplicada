# Implementation Plan: Endpoint de Chat Operacional

**Branch**: `003-chat-endpoint` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)

## Summary

Disponibilizar `POST /chat` como borda HTTP para o contrato de estratégias existente. A rota valida o corpo com Zod, resolve a estratégia pelo registry central, aplica `withReflection` mediante `reflect: true`, impõe timeout de 180 segundos e devolve o `StrategyResult` diretamente. A composição é injetável para permitir testes de integração determinísticos sem LLM, credenciais ou rede externa.

## Technical Context

**Language/Version**: TypeScript ESM strict, Node.js 22 LTS

**Primary Dependencies**: Express 5, Zod 4, LangChain/LangGraph existentes

**Storage**: N/A para a borda HTTP; usa o estado gerenciado pela estratégia selecionada

**Testing**: `node:test` com `tsx`; teste HTTP integrado com registry fake determinístico

**Target Platform**: Serviço HTTP Node.js

**Project Type**: Backend API

**Performance Goals**: Requisições concluídas antes do timeout de 180 s; erro `504` determinado ao exceder esse limite

**Constraints**: Validação Zod em toda entrada externa; sem `.env` em testes; erros previsíveis traduzidos na borda; seleção de estratégia pura e injetável

**Scale/Scope**: Uma rota `POST /chat`, duas estratégias padrão (`react`, `plan-and-execute`) e reflexão opcional; streaming, auth e persistência fora de escopo

## Constitution Check

*GATE: Passed before Phase 0 and rechecked after Phase 1 design.*

- [x] **I. Camadas explícitas**: `src/http/server.ts` é a borda Express; `src/agents/index.ts` contém resolução de estratégia; estratégias não conhecem HTTP.
- [x] **II. Validação na fronteira**: schema Zod valida `req.body` antes de o registry ser usado.
- [x] **III. Erros de domínio**: timeout e estratégia desconhecida têm respostas explícitas na borda; falhas existentes seguem traduzíveis.
- [x] **IV. Teste é parte da tarefa**: teste de integração sem rede cobre `200`, `400`, `422` e `504`.
- [x] **V. Segurança por padrão**: nenhum segredo é lido, escrito ou exigido na suíte de teste.
- [x] **VI. Spec antes do código**: especificação e design estão concluídos antes da implementação.

## Project Structure

### Documentation (this feature)

```text
specs/003-chat-endpoint/
├── checklists/requirements.md
├── contracts/chat-http.md
├── data-model.md
├── plan.md
├── quickstart.md
├── research.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── agents/
│   ├── index.ts              # StrategyRegistry e reflexão opcional
│   ├── react.ts
│   ├── plan-and-execute.ts
│   └── reflection.ts
├── http/
│   ├── server.ts             # Fábrica Express e POST /chat
│   └── server.test.ts        # Integração determinística sem rede externa
├── errors.ts
└── index.ts                  # Inicialização e bind da porta
```

**Structure Decision**: Projeto único Node/TypeScript. `src/http` é a fronteira de transporte; `src/agents` compõe estratégias sem acoplamento ao Express.

## Phase 0: Research

Decisões consolidadas em [research.md](research.md): fábrica Express injetável; schema Zod estrito; registry central; timeout por corrida de promessas; teste HTTP local e determinístico sem dependências externas.

## Phase 1: Design & Contracts

- Dados transitórios e transições: [data-model.md](data-model.md)
- Contrato público: [contracts/chat-http.md](contracts/chat-http.md)
- Cenários executáveis: [quickstart.md](quickstart.md)

## Implementation Sequence

1. Criar `StrategyRegistry` injetável e o registry padrão em `src/agents/index.ts`.
2. Criar schema de request, helper de timeout e fábrica Express em `src/http/server.ts`.
3. Implementar teste de integração com estratégia/registry fake em `src/http/server.test.ts`, cobrindo sucesso, defaults, reflexão, 400, 422 e 504.
4. Conectar `src/index.ts` à fábrica do servidor e expor porta configurável.
5. Executar `npm run typecheck` e `npm run test`; validar os cenários do quickstart.

## Complexity Tracking

Nenhuma violação constitucional ou complexidade excepcional requer justificativa.
