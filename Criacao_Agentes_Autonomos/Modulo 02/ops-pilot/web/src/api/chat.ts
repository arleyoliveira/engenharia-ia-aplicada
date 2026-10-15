export const UNREACHABLE = "Não foi possível alcançar a API.";

export type ChatMessageBody = {
  message: string;
  conversationId?: string;
};

export type ChatDecisionBody = {
  conversationId: string;
  decision: "approve" | "deny";
};

export type ChatBody = ChatMessageBody | ChatDecisionBody;

export type ChatAnswer = {
  kind: "answer";
  requestId: string;
  conversationId?: string;
  answer: string;
  trace: unknown[];
};

export type ChatPending = {
  kind: "pending";
  requestId: string;
  conversationId?: string;
  pendingAction?: { summary?: string };
  trace: unknown[];
};

export type ChatFailure = {
  kind: "error";
  status?: number;
  detail: string;
};

export type ChatResult = ChatAnswer | ChatPending | ChatFailure;

const ERROR_STATUSES = new Set([400, 404, 422, 500, 503, 504]);

export function joinChatUrl(apiBase: string): string {
  return `${apiBase.replace(/\/+$/, "")}/chat`;
}

function textField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readDetail(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as { error?: { message?: unknown } };
    if (typeof record.error?.message === "string" && record.error.message.length > 0) {
      return record.error.message;
    }
  }
  return `A API respondeu ${status}.`;
}

export async function postChat(
  url: string,
  body: ChatBody,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error", detail: UNREACHABLE };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (response.status === 200 || response.status === 202) {
      return { kind: "error", detail: UNREACHABLE };
    }
  }

  const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const trace = Array.isArray(record.trace) ? record.trace : [];

  if (response.status === 200) {
    return {
      kind: "answer",
      requestId: textField(record.requestId),
      conversationId: optionalId(record.conversationId),
      answer: textField(record.answer),
      trace,
    };
  }

  if (response.status === 202) {
    const pending = record.pendingAction;
    return {
      kind: "pending",
      requestId: textField(record.requestId),
      conversationId: optionalId(record.conversationId),
      pendingAction: pending && typeof pending === "object"
        ? { summary: textField((pending as { summary?: unknown }).summary) }
        : undefined,
      trace,
    };
  }

  if (ERROR_STATUSES.has(response.status)) {
    return { kind: "error", status: response.status, detail: readDetail(payload, response.status) };
  }

  return { kind: "error", status: response.status, detail: `A API respondeu ${response.status}.` };
}
