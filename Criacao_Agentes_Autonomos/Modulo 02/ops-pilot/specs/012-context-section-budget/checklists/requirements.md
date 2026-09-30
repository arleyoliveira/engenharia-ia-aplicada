# Specification Quality Checklist: Orçamento de contexto por seção

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-22
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Invariantes do pedido (`src/context/context-builder.ts`, tetos via `CONTEXT_BUDGET_*`, system/mensagem intocáveis, padrões resumo 200 / janela 1200 / memórias 300, corte de janela pelas mais antigas, corte de memórias por menor score, teste com tetos baixos na ordem certa) registradas em Requirements/Assumptions como critérios de aceite. Wiring fino (encapsular vs. substituir `compose-chat-prompt`, nomes exatos das envs) fica para `/speckit-plan`.
- Premissas: unidade = `estimateTokens` existente; resumo corta pelo prefixo até caber; empate de score remove o de pior ranking; env inválido cai no padrão; métricas refletem pós-corte; janela de 8 mensagens (011) aplica-se antes do orçamento por tokens.
- Fora de escopo: teto em system/mensagem, orçamento global único, UI de configuração, mudança de contratos HTTP.
- Sem marcadores [NEEDS CLARIFICATION].
- Validação: todos os itens passam na primeira iteração. Caminhos/envs citados são invariantes do pedido (mesmo padrão das specs 010/011), não vazamento acidental de stack.
