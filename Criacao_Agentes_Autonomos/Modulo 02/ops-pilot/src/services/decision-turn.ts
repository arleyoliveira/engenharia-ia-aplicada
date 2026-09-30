import type { Metrics, TraceEvent } from "../agents/types.js";

export type DecisionName = "approve" | "deny";

export interface DecisionTurn {
  answer: string;
  userLine: string;
  trace: TraceEvent[];
  metrics: Metrics;
}

export function decisionTurn(decision: DecisionName): DecisionTurn {
  const approved = decision === "approve";
  const answer = approved ? "Aprovado." : "Negado.";
  return {
    answer,
    userLine: approved ? "Aprovar" : "Negar",
    trace: [{ type: "answer", content: answer, node: "decisao" }],
    metrics: { llmCalls: 0, latencyMs: 0 },
  };
}
