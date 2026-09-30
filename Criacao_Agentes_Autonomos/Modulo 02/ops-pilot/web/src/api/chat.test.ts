import { describe, expect, it, vi } from "vitest";
import { joinChatUrl, postChat, UNREACHABLE } from "./chat";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("joinChatUrl", () => {
  it("acrescenta uma única /chat", () => {
    expect(joinChatUrl("http://localhost:3000")).toBe("http://localhost:3000/chat");
    expect(joinChatUrl("http://localhost:3000/")).toBe("http://localhost:3000/chat");
    expect(joinChatUrl("http://localhost:3000/prefix/")).toBe("http://localhost:3000/prefix/chat");
  });
});

describe("postChat", () => {
  it("classifica 200, 202, erros HTTP e falha de rede", async () => {
    const fetchOk = vi.fn(async () => jsonResponse(200, {
      requestId: "req-1",
      conversationId: "conv-1",
      answer: "pronto",
      trace: [{ type: "answer", content: "pronto" }],
    }));
    const answer = await postChat("http://localhost:3000/chat", { message: "oi" }, fetchOk);
    expect(answer).toEqual({
      kind: "answer",
      requestId: "req-1",
      conversationId: "conv-1",
      answer: "pronto",
      trace: [{ type: "answer", content: "pronto" }],
    });
    expect(fetchOk).toHaveBeenCalledWith("http://localhost:3000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "oi" }),
    });

    const pending = await postChat(
      "http://localhost:3000/chat",
      { message: "agir" },
      vi.fn(async () => jsonResponse(202, {
        requestId: "req-2",
        conversationId: "conv-2",
        pendingAction: { summary: "abrir" },
      })),
    );
    expect(pending).toMatchObject({
      kind: "pending",
      requestId: "req-2",
      conversationId: "conv-2",
      pendingAction: { summary: "abrir" },
      trace: [],
    });

    for (const status of [400, 404, 422, 500, 503, 504]) {
      const failed = await postChat(
        "http://localhost:3000/chat",
        { message: "x" },
        vi.fn(async () => jsonResponse(status, { error: { message: `falha ${status}` } })),
      );
      expect(failed).toEqual({ kind: "error", status, detail: `falha ${status}` });
    }

    const network = await postChat(
      "http://localhost:3000/chat",
      { message: "x" },
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(network).toEqual({ kind: "error", detail: UNREACHABLE });
  });

  it("trata JSON ilegível no 200 como erro de alcance", async () => {
    const result = await postChat(
      "http://localhost:3000/chat",
      { message: "x" },
      vi.fn(async () => new Response("não json", { status: 200 })),
    );
    expect(result).toEqual({ kind: "error", detail: UNREACHABLE });
  });
});
