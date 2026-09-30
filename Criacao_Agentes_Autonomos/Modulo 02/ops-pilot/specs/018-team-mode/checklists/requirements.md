# Specification Quality Checklist: Modo equipe

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

- Invariantes do pedido (`src/team/`, saída estruturada `next`+`brief` sobre o blackboard no estado, papéis analista / planejador / executor com os limites de ferramenta, evento `handoff`, renderização em "ver raciocínio", rota `team`, teto 8) registrados em Requirements/Assumptions como critérios de aceite. Nomes de arquivo dentro de `src/team/` e o encaixe no grafo ficam para `/speckit-plan`.
- Premissas: `fim` encerra e o `brief` é a resposta; teto 8 conta handoffs e a frase de limite reutiliza a dos outros modos; o analista só escreve achados; o executor só muta incidente por `open_incident` e `resolve_incident` já validadas, depois do handoff; o quadro não vira tabela nova; `reflect: true` não embrulha `team`.
- Fora de escopo: cartão `202` novo, quinta rota, persistir o blackboard entre turnos, arena/CLI invocando o modo direto.
- Sem marcadores [NEEDS CLARIFICATION].
- Validação: todos os itens passam na primeira iteração. Caminhos, rota e nomes de campo citados são invariantes do pedido (mesmo padrão das specs 013 e 016), não vazamento acidental de stack.
