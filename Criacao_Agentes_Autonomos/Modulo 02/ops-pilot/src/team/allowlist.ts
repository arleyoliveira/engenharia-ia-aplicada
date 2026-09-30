import type { TeamRole } from "./blackboard.js";

export interface NamedTool {
  name: string;
  invoke(args: unknown): Promise<unknown>;
}

const ANALYST_TOOLS = [
  "list_alerts",
  "list_incidents",
  "consultar_runbook",
  "check_provider_status",
] as const;

const EXECUTOR_TOOLS = ["open_incident", "resolve_incident"] as const;

export function toolsFor(role: TeamRole, tools: readonly NamedTool[]): NamedTool[] {
  const names =
    role === "analista" ? ANALYST_TOOLS : role === "executor" ? EXECUTOR_TOOLS : [];
  return names.flatMap((name) => {
    const tool = tools.find((item) => item.name === name);
    return tool ? [tool] : [];
  });
}
