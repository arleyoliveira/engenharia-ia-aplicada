# Specification Quality Checklist: War room web

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-28
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

- Invariantes do pedido (`web/` com Vite, React e TypeScript, base `/opspilot/`, `POST /chat`, "ver raciocínio" no trace tipado, `202` como cartão Aprovar/Negar, engrenagem com URL da API, CORS e `.github/instructions/design.instructions.md`) registrados em Requirements como critérios de aceite. Histórias e critérios de sucesso descrevem o resultado para o plantonista.
- Premissas: URL inicial `http://localhost:3000`; decisão é `{ conversationId, decision: "approve" | "deny" }` sem `message`; a war room não envia `strategy`, `reflect` nem `userId`; o `202` é consumido (o teste usa chat fake) e esta feature não define quando o agente interrompe o turno; CORS libera a origem da página, sem cookie.
- Fora de escopo: política que gera o `202`, autenticação, histórico de pedidos, arena, CLI, app nativo e redirecionamento da raiz `/`.
- Sem marcadores [NEEDS CLARIFICATION].
- Validação: todos os itens passam na primeira iteração. Caminhos, status HTTP e o stack nomeado no pedido são invariantes (mesmo padrão das specs 003/015), não vazamento acidental de stack.
