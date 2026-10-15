import { describe, expect, it } from "vitest";
import { applyOutcome, enqueueMessage, initialThread, retry } from "./thread";

describe("thread", () => {
  it("guarda a conversa, ignora texto vazio e reenvia o erro", () => {
    const initial = initialThread();
    expect(initial.turns).toEqual([]);
    expect(initial.conversationId).toBeUndefined();

    expect(enqueueMessage(initial, "   ")).toBe(initial);

    const sending = enqueueMessage(initial, " ola ");
    expect(sending.inFlight).toBe(true);
    expect(sending.pendingBody).toEqual({ message: "ola" });
    expect(sending.turns).toEqual([{ kind: "user", text: "ola" }]);

    const answered = applyOutcome(sending, {
      kind: "answer",
      requestId: "req-1",
      conversationId: "conv-1",
      answer: "pronto",
      trace: [],
    });
    expect(answered.inFlight).toBe(false);
    expect(answered.conversationId).toBe("conv-1");
    expect(answered.turns[1]).toMatchObject({
      kind: "answer",
      requestId: "req-1",
      answer: "pronto",
      trace: [],
    });

    const second = enqueueMessage(answered, "de novo");
    expect(second.pendingBody).toEqual({ message: "de novo", conversationId: "conv-1" });

    const failed = applyOutcome(second, { kind: "error", status: 500, detail: "falhou" });
    expect(failed.turns[0]).toEqual(sending.turns[0]);
    expect(failed.turns.at(-1)).toMatchObject({
      kind: "error",
      status: 500,
      detail: "falhou",
      retry: { message: "de novo", conversationId: "conv-1" },
    });

    const again = retry(failed);
    expect(again.inFlight).toBe(true);
    expect(again.pendingBody).toEqual({ message: "de novo", conversationId: "conv-1" });
  });
});
