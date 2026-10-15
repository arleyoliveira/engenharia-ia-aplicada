/** Tipos puros do núcleo de raciocínio (contracts/trace.md). Sem IO. */

export type TraceEventType =
  | "thought"
  | "action"
  | "observation"
  | "plan"
  | "critique"
  | "answer"
  | "summarize"
  | "route"
  | "fallback"
  | "handoff";

type WithNode<T> = T & { node?: string };

export type TraceEvent =
  | {
      type: "route";
      route: string;
      reason: string;
      override: boolean;
      node: "roteador";
    }
  | WithNode<{ type: "thought"; content: string }>
  | WithNode<{ type: "observation"; content: string }>
  | WithNode<{ type: "critique"; content: string }>
  | WithNode<{ type: "action"; tool: string; args: unknown }>
  | WithNode<{ type: "plan"; steps: string[] }>
  | WithNode<{ type: "answer"; content: string }>
  | WithNode<{ type: "summarize"; content: string }>
  | WithNode<{ type: "fallback"; from: string; to: string }>
  | {
      type: "handoff";
      from: "supervisor";
      to: "analista" | "planejador" | "executor" | "done";
      brief: string;
      node: "supervisor";
    };

export interface ContextBreakdown {
  message: number;
  history: number;
  memories: number;
  summary: number;
}

export interface Metrics {
  llmCalls: number;
  latencyMs: number;
  historyMessages?: number;
  recalledMemories?: number;
  /** Soma real dos tokens de entrada reportados no turn (usage LangChain). */
  promptTokens?: number;
  /** Estimativa por fonte (floor chars/4); não precisa igualar promptTokens. */
  contextBreakdown?: ContextBreakdown;
  /** Chamadas do turn atendidas pelo modelo reserva. */
  fallbacks?: number;
}

export type ChatHistoryRole = "user" | "assistant";

export interface ChatHistoryMessage {
  role: ChatHistoryRole;
  content: string;
}

/** Entrada de um turn: mensagem atual + histórico + memórias + resumo opcional. */
export interface ChatTurnInput {
  message: string;
  history?: readonly ChatHistoryMessage[];
  memories?: readonly string[];
  summary?: string;
}

export type StrategyInput = string | ChatTurnInput;

export interface StrategyResult {
  answer: string;
  trace: TraceEvent[];
  metrics: Metrics;
}

export interface StrategyRunOptions {
  maxIterations?: number;
  noReplanner?: boolean;
  tools?: readonly unknown[];
}

export interface CritiqueResult {
  approved: boolean;
  feedback: string;
}

export interface ReflectionOptions {
  maxReflections?: number;
  name?: string;
}

export interface ReasoningStrategy {
  readonly name: string;
  run(input: StrategyInput, options?: StrategyRunOptions): Promise<StrategyResult>;
}
