/** Quadro do turno. Funções puras: cada escrita devolve um quadro novo. */

export const TEAM_NEXT = ["analista", "planejador", "executor", "done"] as const;
export type TeamNext = (typeof TEAM_NEXT)[number];
export type TeamRole = Exclude<TeamNext, "done">;

export interface IncidentAction {
  tool: "open_incident" | "resolve_incident";
  args: unknown;
  observation: string;
}

export interface Blackboard {
  findings: string;
  plan: string;
  actions: readonly IncidentAction[];
  briefs: readonly { next: TeamNext; brief: string }[];
}

export function emptyBlackboard(): Blackboard {
  return { findings: "", plan: "", actions: [], briefs: [] };
}

export function appendFindings(board: Blackboard, findings: string): Blackboard {
  const text = findings.trim();
  if (text.length === 0) {
    return board;
  }
  return {
    ...board,
    findings: board.findings.length > 0 ? `${board.findings}\n${text}` : text,
  };
}

export function replacePlan(board: Blackboard, plan: string): Blackboard {
  return { ...board, plan };
}

export function appendAction(board: Blackboard, action: IncidentAction): Blackboard {
  return { ...board, actions: [...board.actions, action] };
}

export function appendBrief(
  board: Blackboard,
  entry: { next: TeamNext; brief: string },
): Blackboard {
  return { ...board, briefs: [...board.briefs, entry] };
}

export function blackboardAsText(state: {
  message: string;
  blackboard: Blackboard;
}): string {
  const { blackboard } = state;
  const actions =
    blackboard.actions.length === 0
      ? "(nenhuma)"
      : blackboard.actions
          .map(
            (action) =>
              `- ${action.tool} ${JSON.stringify(action.args)} → ${action.observation}`,
          )
          .join("\n");
  const briefs =
    blackboard.briefs.length === 0
      ? "(nenhum)"
      : blackboard.briefs
          .map((entry) => `- ${entry.next}: ${entry.brief}`)
          .join("\n");
  return [
    `Pedido: ${state.message}`,
    "",
    "Achados:",
    blackboard.findings.length > 0 ? blackboard.findings : "(vazio)",
    "",
    "Plano:",
    blackboard.plan.length > 0 ? blackboard.plan : "(vazio)",
    "",
    "Ações:",
    actions,
    "",
    "Recados:",
    briefs,
  ].join("\n");
}
