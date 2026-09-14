# Feature Specification: Camada de Reflection para Estratégias de Raciocínio

**Feature Branch**: `002-reflection-layer`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Camada Reflection: withReflection(strategy, opts) decora qualquer ReasoningStrategy: executa a base; um crítico (mesmo modelo, saída estruturada { approved, feedback}) avalia a resposta contra as observações do trace; se reprovar, regenera com o feedback no contexto, para em approved ou maxReflections(default: 2). Evento \"critique\" no trace; métricas somam as chamadas extras. Arena refect:react e reflec:plan-and-execute"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validação Crítica e Auto-Correção de Respostas Operacionais (Priority: P1)

Um plantonista ou operador envia uma pergunta ou comando operacional complexo para o OpsPilot. O agente executa sua estratégia base de raciocínio e obtém uma resposta preliminar. Antes de devolver essa resposta ao usuário, um crítico avalia se a resposta proposta é factualmente consistente com as evidências e observações coletadas durante a execução das ferramentas. Caso o crítico reprove por identificar inconsistências, alucinações ou omissões, o agente reexecuta o raciocínio levando o feedback do crítico em consideração até ser aprovado ou até atingir o limite estipulado de reflexões (padrão de 2 tentativas).

**Why this priority**: É o valor principal da reflexão: evitar respostas incorretas ou alucinações ao confrontar a resposta gerada com as observações factuais das ferramentas antes da entrega final ao operador.

**Independent Test**: Executar uma estratégia decorada com reflexão sobre um cenário com dados ruidosos ou resposta inicial parcial e verificar que o crítico avalia a saída, gera eventos de crítica no trace e, havendo reprovação, aciona uma regeneração com feedback que produz uma resposta corrigida e consistente.

**Acceptance Scenarios**:

1. **Given** uma estratégia de raciocínio decorada com reflexão e uma resposta inicial consistente com as observações do trace, **When** o crítico avalia a resposta, **Then** a resposta é aprovada de primeira, o evento de crítica é registrado no trace e a resposta final é entregue sem ciclos extras de regeneração.
2. **Given** uma estratégia de raciocínio cuja primeira tentativa gera uma resposta divergente ou incompleta em relação às observações das ferramentas, **When** o crítico reprova e fornece feedback corretivo, **Then** a estratégia base é reexecutada com o feedback injetado no contexto, gerando nova resposta que é reavaliada.
3. **Given** uma configuração com limite de reflexões definido (padrão: 2), **When** a resposta continua sendo reprovada após atingir o número máximo de reflexões, **Then** o ciclo de reflexão é interrompido de forma graciosa e a melhor resposta disponível é retornada, acompanhada do registro explícito do limite no trace.

---

### User Story 2 - Comparação de Estratégias com e sem Reflexão na Arena (Priority: P2)

Um desenvolvedor ou engenheiro de operações deseja avaliar o ganho de qualidade e o custo adicional (latência e chamadas ao modelo) trazidos pela camada de reflexão. Na CLI da arena, ele solicita estratégias base e suas versões decoradas com reflexão (por exemplo, `react`, `reflect:react`, `plan-and-execute`, `reflect:plan-and-execute`) para o mesmo comando ou pergunta, visualizando lado a lado as respostas, os traces detalhados e as métricas consolidadas.

**Why this priority**: Permite calibrar se o ganho em precisão justifica o custo adicional de chamadas e latência para diferentes tipos de consultas operacionais.

**Independent Test**: Executar a CLI da arena solicitando `react,reflect:react` para a mesma entrada e confirmar que a arena roda ambas as estratégias e exibe métricas com o somatório de chamadas ao modelo e tempo para cada uma.

**Acceptance Scenarios**:

1. **Given** a arena invocada com as estratégias `reflect:react` e `reflect:plan-and-execute`, **When** a execução é concluída, **Then** ambas executam o mesmo input e exibem suas respostas, traces de eventos formatados e métricas consolidadas separadamente.
2. **Given** uma estratégia refletida que passou por 1 ciclo de crítica e regeneração, **When** as métricas são exibidas, **Then** a contagem de chamadas ao modelo reflete a soma da execução inicial, da chamada do crítico e da regeneração subjacente.

---

### User Story 3 - Rastreabilidade e Auditoria Completa dos Julgamentos do Crítico (Priority: P3)

Um operador ou auditor investiga o motivo de uma decisão tomada pelo agente e deseja entender se houve correções automáticas intermediárias. Ele inspeciona o trace tipado da execução e identifica os eventos de crítica, visualizando se a resposta foi aprovada ou reprovada, os motivos do parecer do crítico e quais correções foram sugeridas ao longo do processo.

**Why this priority**: Garante explicabilidade e transparência das decisões autônomas tomadas pelo agente, essencial para ambientes de produção e confiabilidade de plantão.

**Independent Test**: Inspecionar a estrutura do trace de uma execução com reflexão e validar que os eventos de crítica contêm campos tipados estruturados e são renderizados na ordem cronológica correta na saída formatada do trace.

**Acceptance Scenarios**:

1. **Given** uma execução com reflexão, **When** o trace é gerado, **Then** cada avaliação do crítico aparece como um evento tipado `critique`, contendo o veredito (aprovado/reprovado) e a justificativa/feedback textual.
2. **Given** uma reexecução após reprovação, **When** os eventos são serializados, **Then** a ordem cronológica reflete: execução base 1 -> crítica 1 -> reexecução base 2 -> crítica 2 -> resposta final.

---

### Edge Cases

- **Crítico falha ao produzir saída estruturada**: se o modelo falhar na avaliação crítica ou retornar saída malformada, o sistema deve registrar a falha de julgamento sem quebrar a execução, utilizando uma estratégia de fallback segura (por exemplo, aprovar com aviso ou interromper o ciclo).
- **Entrada sem observações ou sem ações de ferramentas**: quando a estratégia base responde diretamente sem chamar ferramentas (ex.: pergunta conceitual simples), o crítico deve avaliar a coerência da resposta com a pergunta sem exigir observações de ferramentas inexistentes.
- **Estratégia base lança erro de domínio**: se a estratégia base falhar com um erro de domínio irrecuperável (ex.: `NotFoundError`, `InvalidStateError`), a camada de reflexão deve propagar o erro sem tentar regenerar cegamente.
- **Configuração de `maxReflections: 0`**: se o usuário configurar 0 reflexões máximas, a estratégia decorada executa apenas a estratégia base sem invocar o crítico.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST disponibilizar uma função decoradora (`withReflection`) capaz de envolver qualquer instância do contrato de estratégia de raciocínio (`ReasoningStrategy`) sem alterar o contrato externo.
- **FR-002**: A estratégia decorada MUST executar a estratégia base para obter a resposta inicial, o trace de execução e as métricas preliminares.
- **FR-003**: O componente crítico MUST usar o mesmo modelo de linguagem com saída estruturada contendo o veredito booleano (`approved`) e o parecer corretivo (`feedback`).
- **FR-004**: O crítico MUST receber o objetivo original do usuário, a resposta candidata gerada e as observações factuais extraídas do trace para julgar a coerência factual.
- **FR-005**: Caso o veredito seja reprovado (`approved: false`) e o limite de reflexões não tenha sido atingido, o sistema MUST reexecutar a estratégia base injetando o feedback corretivo no contexto da nova execução.
- **FR-006**: O limite padrão de reflexões MUST ser de 2 ciclos (`maxReflections: 2`), parametrizável via opções na criação do decorador ou na execução.
- **FR-007**: Toda avaliação do crítico MUST registrar um evento tipado `critique` no trace de raciocínio, contendo o veredito e o texto de feedback.
- **FR-008**: As métricas da estratégia decorada MUST totalizar o número acumulado de chamadas ao modelo e a latência de ponta a ponta (incluindo execuções base, chamadas do crítico e regenerações).
- **FR-009**: A CLI da arena MUST disponibilizar as opções de estratégia decoradas `reflect:react` e `reflect:plan-and-execute` (e aliases correspondentes), permitindo comparação direta com suas variantes originais.

### Key Entities *(include if feature involves data)*

- **ReflectionOptions**: Configurações da camada de reflexão, contendo `maxReflections` (número máximo de ciclos de crítica/regeneração, default 2) e opções opcionais de customização de prompt do crítico.
- **CritiqueResult**: Resultado estruturado emitido pelo crítico, composto por `approved` (booleano) e `feedback` (string com justificativa ou instruções corretivas).
- **ReasoningStrategy**: Contrato unificado de estratégia de raciocínio (`name`, `run(input, options) -> Promise<StrategyResult>`), preservado transparentemente pela camada decorada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das execuções decoradas com reflexão registram eventos de crítica (`critique`) com veredito e feedback rastreáveis no trace de saída.
- **SC-002**: As métricas de chamadas ao modelo de uma estratégia refletida refletem com precisão de 100% a soma das chamadas da estratégia base e das chamadas do crítico.
- **SC-003**: Quando uma resposta inicial é reprovada pelo crítico, a resposta final reexecutada demonstra correção das inconsistências apontadas em até 2 ciclos de reflexão.
- **SC-004**: A CLI da arena suporta a execução comparativa simultânea de estratégias base e refletidas em um único comando sem interrupção de execução.

## Assumptions

- O modelo configurado em ambiente possui capacidade de análise crítica e suporte a saída estruturada para emissão do veredito `{ approved, feedback }`.
- O valor padrão de `maxReflections` é 2, considerado suficiente para correção de desvios comuns sem gerar custos excessivos de chamadas de LLM.
- O nome da estratégia decorada adota o prefixo `reflect:` seguido pelo nome da estratégia base (ex.: `reflect:react`, `reflect:plan-and-execute`), com suporte tolerante a variações de grafia na CLI caso necessário.
