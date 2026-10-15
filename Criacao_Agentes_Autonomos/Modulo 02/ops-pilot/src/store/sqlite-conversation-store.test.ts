import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NotFoundError } from "../errors.js";
import { SqliteOpsStore } from "./sqlite-ops-store.js";
import { SqliteConversationStore } from "./sqlite-conversation-store.js";

describe("SqliteConversationStore", () => {
  function createStore(): SqliteConversationStore {
    const ops = new SqliteOpsStore(":memory:");
    return new SqliteConversationStore(ops.db);
  }

  it("create + append + lastMessages em ordem cronológica", () => {
    const store = createStore();
    const id = store.create();
    store.append(id, { role: "user", content: "oi" });
    store.append(id, { role: "assistant", content: "olá" });

    const messages = store.lastMessages(id, 12);
    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.role, "user");
    assert.equal(messages[0]?.content, "oi");
    assert.equal(messages[1]?.role, "assistant");
    assert.equal(messages[1]?.content, "olá");
  });

  it("lastMessages limita às N mais recentes (ordem crescente no retorno)", () => {
    const store = createStore();
    const id = store.create();
    for (let i = 1; i <= 5; i += 1) {
      store.append(id, { role: "user", content: `m${i}` });
    }

    const messages = store.lastMessages(id, 3);
    assert.deepEqual(
      messages.map((m) => m.content),
      ["m3", "m4", "m5"],
    );
  });

  it("id inexistente em append e lastMessages → NotFoundError", () => {
    const store = createStore();
    assert.throws(
      () => store.append("missing", { role: "user", content: "x" }),
      NotFoundError,
    );
    assert.throws(() => store.lastMessages("missing", 12), NotFoundError);
  });

  it("limit < 1 → InvalidStateError", async () => {
    const { InvalidStateError } = await import("../errors.js");
    const store = createStore();
    const id = store.create();
    assert.throws(() => store.lastMessages(id, 0), InvalidStateError);
  });

  it("upsertSummary + getSummary round-trip", () => {
    const store = createStore();
    const id = store.create();
    store.append(id, { role: "user", content: "a" });
    store.append(id, { role: "assistant", content: "b" });
    const msgs = store.lastMessages(id, 2);
    const covered = msgs[1]?.id ?? 0;

    store.upsertSummary(id, {
      text: "resumo vigente",
      coveredThroughMessageId: covered,
    });

    const summary = store.getSummary(id);
    assert.ok(summary);
    assert.equal(summary.text, "resumo vigente");
    assert.equal(summary.coveredThroughMessageId, covered);
    assert.equal(summary.conversationId, id);
  });

  it("getSummary sem linha → null; id inexistente → NotFoundError", () => {
    const store = createStore();
    const id = store.create();
    assert.equal(store.getSummary(id), null);
    assert.throws(() => store.getSummary("missing"), NotFoundError);
  });

  it("messagesBefore respeita after/before/limit e ordem", () => {
    const store = createStore();
    const id = store.create();
    for (let i = 1; i <= 10; i += 1) {
      store.append(id, { role: "user", content: `m${i}` });
    }
    const all = store.lastMessages(id, 10);
    const before = all[7]?.id ?? 0; // m8
    const after = all[1]?.id ?? 0; // m2
    // ids > m2 and < m8 → m3..m7
    const slice = store.messagesBefore(id, before, after, 10);
    assert.deepEqual(
      slice.map((m) => m.content),
      ["m3", "m4", "m5", "m6", "m7"],
    );
    assert.equal(store.messagesBefore(id, before, after, 2).length, 2);
  });
});
