import { TracePanel } from "./TracePanel";

type DecisionCardProps = {
  summary: string;
  requestId: string;
  trace: readonly unknown[];
  open: boolean;
  choice?: "approve" | "deny";
  onToggle: () => void;
  onDecide: (decision: "approve" | "deny") => void;
};

export function DecisionCard({
  summary,
  requestId,
  trace,
  open,
  choice,
  onToggle,
  onDecide,
}: DecisionCardProps) {
  return (
    <article className="card">
      <h2>Decisão pendente</h2>
      <p>{summary}</p>
      {requestId.length > 0 && <p className="meta">{requestId}</p>}
      <TracePanel trace={trace} open={open} onToggle={onToggle} />
      {choice ? (
        <p>{choice === "approve" ? "Aprovar" : "Negar"}</p>
      ) : (
        <div className="actions">
          <button type="button" onClick={() => onDecide("approve")}>Aprovar</button>
          <button type="button" className="secondary" onClick={() => onDecide("deny")}>Negar</button>
        </div>
      )}
    </article>
  );
}
