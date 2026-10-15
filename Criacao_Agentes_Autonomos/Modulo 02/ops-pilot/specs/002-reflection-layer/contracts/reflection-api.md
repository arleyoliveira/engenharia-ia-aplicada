# Contract: API TypeScript da Camada de Reflection

**Date**: 2026-09-11 | **Spec**: [spec.md](../spec.md)

## Módulo: `src/agents/reflection.ts`

### 1. Assinatura da Função Decoradora

```typescript
import type { ReasoningStrategy, StrategyResult, StrategyRunOptions } from "./types.js";

export interface ReflectionOptions {
  /** Número máximo de ciclos de crítica e regeneração (default: 2). */
  maxReflections?: number;
  /** Nome customizado para a estratégia decorada (default: `reflect:${strategy.name}`). */
  name?: string;
}

/**
 * Decora qualquer ReasoningStrategy adicionando uma camada de reflexão crítica.
 * Executa a base, avalia a resposta contra as observações do trace via LLM estruturado,
 * e reexecuta com feedback corretivo caso reprovado.
 */
export function withReflection(
  strategy: ReasoningStrategy,
  options?: ReflectionOptions,
): ReasoningStrategy;
```

### 2. Contrato de Prompt do Crítico

O componente crítico utiliza o seguinte template estruturado:

- **System Prompt**:
  ```text
  Você é o crítico de qualidade do OpsPilot, copilot de plantão.
  Sua responsabilidade é avaliar se a resposta proposta pelo agente é factualmente consistente com as observações reais obtidas das ferramentas e se atende completamente ao objetivo solicitado pelo plantonista.

  Critérios de Avaliação:
  1. Factualidade: a resposta afirma apenas fatos comprovados pelas observações?
  2. Completude: todos os pontos do objetivo do plantonista foram atendidos na ordem correta?
  3. Ações inexistentes: a resposta não inventa dados sobre serviços ou alertas que não existam nas observações?

  Responda estritamente no schema estruturado com approved (boolean) e feedback (string com orientações claras caso reprovado, ou justificativa concisa caso aprovado).
  ```

- **User Message**:
  ```text
  Objetivo solicitado: {input}

  Observações coletadas no trace:
  {observations}

  Resposta proposta pelo agente:
  {candidateAnswer}
  ```

### 3. Contrato de Injeção de Feedback na Reexecução

Quando `approved === false`, a estratégia base é reinvocada com o seguinte formato de prompt:

```text
{originalInput}

[Feedback do Crítico na tentativa anterior]:
{feedback}
Por favor, reavalie suas ações e gere uma resposta corrigida considerando este feedback.
```
