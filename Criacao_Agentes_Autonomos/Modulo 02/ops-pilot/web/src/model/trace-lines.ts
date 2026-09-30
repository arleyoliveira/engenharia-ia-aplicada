export type TraceLine = { label: string; value: string };

export type TraceView = {
  type: string;
  node?: string;
  lines: TraceLine[];
};

const CONTENT_TYPES = new Set(["thought", "observation", "critique", "summarize", "answer"]);

function asRecord(event: unknown): Record<string, unknown> {
  if (event && typeof event === "object") {
    return event as Record<string, unknown>;
  }
  return { value: event };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

export function presentTrace(events: readonly unknown[]): TraceView[] {
  return events.map((event) => {
    const record = asRecord(event);
    const type = typeof record.type === "string" ? record.type : "unknown";
    const node = typeof record.node === "string" && record.node.length > 0 ? record.node : undefined;
    return { type, node, lines: linesFor(type, record) };
  });
}

function linesFor(type: string, record: Record<string, unknown>): TraceLine[] {
  if (CONTENT_TYPES.has(type)) {
    return [{ label: "content", value: text(record.content) }];
  }
  if (type === "action") {
    return [
      { label: "tool", value: text(record.tool) },
      { label: "args", value: JSON.stringify(record.args ?? null) },
    ];
  }
  if (type === "plan") {
    const steps = Array.isArray(record.steps) ? record.steps : [];
    return steps.map((step) => ({ label: "steps", value: text(step) }));
  }
  if (type === "route") {
    return [
      { label: "route", value: text(record.route) },
      { label: "reason", value: text(record.reason) },
      { label: "override", value: record.override === true ? "sim" : "não" },
    ];
  }
  if (type === "fallback") {
    return [
      { label: "from", value: text(record.from) },
      { label: "to", value: text(record.to) },
    ];
  }
  if (type === "handoff") {
    return [
      { label: "from", value: text(record.from) },
      { label: "to", value: text(record.to) },
      { label: "brief", value: text(record.brief) },
    ];
  }
  return [{ label: "evento", value: JSON.stringify(record) }];
}
