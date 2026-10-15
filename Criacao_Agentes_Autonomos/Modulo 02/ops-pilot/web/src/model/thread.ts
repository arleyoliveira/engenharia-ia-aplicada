import type { ChatBody, ChatResult } from "../api/chat";

export const PENDING_FALLBACK = "Ação aguardando decisão";

export type UserTurn = { kind: "user"; text: string };

export type AnswerTurn = {
  kind: "answer";
  requestId: string;
  answer: string;
  trace: unknown[];
  traceOpen: boolean;
};

export type CardTurn = {
  kind: "card";
  requestId: string;
  conversationId?: string;
  summary: string;
  trace: unknown[];
  traceOpen: boolean;
  choice?: "approve" | "deny";
};

export type ErrorTurn = {
  kind: "error";
  status?: number;
  detail: string;
  retry: ChatBody;
};

export type Turn = UserTurn | AnswerTurn | CardTurn | ErrorTurn;

export type ThreadState = {
  turns: Turn[];
  conversationId?: string;
  inFlight: boolean;
  pendingBody: ChatBody | null;
};

export function initialThread(): ThreadState {
  return { turns: [], inFlight: false, pendingBody: null };
}

function messageBody(state: ThreadState, text: string): ChatBody {
  const body: ChatBody = { message: text };
  if (state.conversationId) {
    body.conversationId = state.conversationId;
  }
  return body;
}

export function enqueueMessage(state: ThreadState, text: string): ThreadState {
  const trimmed = text.trim();
  if (trimmed.length === 0 || state.inFlight) {
    return state;
  }
  const pendingBody = messageBody(state, trimmed);
  return {
    ...state,
    inFlight: true,
    pendingBody,
    turns: [...state.turns, { kind: "user", text: trimmed }],
  };
}

export function applyOutcome(state: ThreadState, outcome: ChatResult): ThreadState {
  if (outcome.kind === "answer") {
    return {
      ...state,
      inFlight: false,
      pendingBody: null,
      conversationId: outcome.conversationId ?? state.conversationId,
      turns: [...state.turns, {
        kind: "answer",
        requestId: outcome.requestId,
        answer: outcome.answer,
        trace: outcome.trace,
        traceOpen: false,
      }],
    };
  }
  if (outcome.kind === "pending") {
    const summary = outcome.pendingAction?.summary?.trim() ?? "";
    return {
      ...state,
      inFlight: false,
      pendingBody: null,
      conversationId: outcome.conversationId ?? state.conversationId,
      turns: [...state.turns, {
        kind: "card",
        requestId: outcome.requestId,
        conversationId: outcome.conversationId,
        summary: summary.length > 0 ? summary : PENDING_FALLBACK,
        trace: outcome.trace,
        traceOpen: false,
      }],
    };
  }
  if (!state.pendingBody) {
    return { ...state, inFlight: false, pendingBody: null };
  }
  return {
    ...state,
    inFlight: false,
    pendingBody: null,
    turns: [...state.turns, {
      kind: "error",
      status: outcome.status,
      detail: outcome.detail,
      retry: state.pendingBody,
    }],
  };
}

export function retry(state: ThreadState): ThreadState {
  if (state.inFlight) {
    return state;
  }
  const error = [...state.turns].reverse().find((turn) => turn.kind === "error");
  if (!error || error.kind !== "error") {
    return state;
  }
  return { ...state, inFlight: true, pendingBody: error.retry };
}

export function toggleTrace(state: ThreadState, index: number): ThreadState {
  return {
    ...state,
    turns: state.turns.map((turn, turnIndex) => {
      if (turnIndex !== index) {
        return turn;
      }
      if (turn.kind === "answer" || turn.kind === "card") {
        return { ...turn, traceOpen: !turn.traceOpen };
      }
      return turn;
    }),
  };
}

export function decide(state: ThreadState, index: number, decision: "approve" | "deny"): ThreadState {
  if (state.inFlight) {
    return state;
  }
  const turn = state.turns[index];
  if (!turn || turn.kind !== "card" || turn.choice || !turn.conversationId) {
    return state;
  }
  return {
    ...state,
    inFlight: true,
    pendingBody: { conversationId: turn.conversationId, decision },
    turns: state.turns.map((item, itemIndex) => (
      itemIndex === index && item.kind === "card" ? { ...item, choice: decision } : item
    )),
  };
}
