import { presentTrace } from "../model/trace-lines";

type TracePanelProps = {
  trace: readonly unknown[];
  open: boolean;
  onToggle: () => void;
};

export function TracePanel({ trace, open, onToggle }: TracePanelProps) {
  const views = presentTrace(trace);
  return (
    <div className="trace">
      <button type="button" aria-expanded={open} onClick={onToggle}>
        ver raciocínio
      </button>
      {open && views.length === 0 && <p>Não há eventos de raciocínio neste turno.</p>}
      {open && views.length > 0 && (
        <div role="region" aria-label="Raciocínio">
          {views.map((view, index) => (
            <article className="event" key={`${view.type}-${index}`}>
              <h3>{view.type}</h3>
              {view.node && <p className="meta">{view.node}</p>}
              {view.lines.map((line, lineIndex) => (
                <p key={`${line.label}-${lineIndex}`}>
                  <span>{line.label}</span>
                  {": "}
                  <span>{line.value}</span>
                </p>
              ))}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
