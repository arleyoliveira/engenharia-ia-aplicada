/** Tipos puros do núcleo de raciocínio (contracts/trace.md). Sem IO. */

export type TraceEventType =
  | "thought"
  | "action"
  | "observation"
  | "plan"
  | "critique"
  | "answer";

export type TraceEvent =
  | { type: "thought"; content: string }
  | { type: "observation"; content: string }
  | { type: "critique"; content: string }
  | { type: "action"; tool: string; args: unknown }
  | { type: "plan"; steps: string[] }
  | { type: "answer"; content: string };

export interface Metrics {
  llmCalls: number;
  latencyMs: number;
}

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
  run(input: string, options?: StrategyRunOptions): Promise<StrategyResult>;
}
