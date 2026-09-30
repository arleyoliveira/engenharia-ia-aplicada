import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryMemoryStore } from "../memory-store.js";
import { createForgetPreferenceTool } from "./memory-tools.js";

describe("forget_preference tool", () => {
  it("remove preferência existente via recall top-1", async () => {
    const memory = new InMemoryMemoryStore();
    memory.seedRecall("alice", ["prefiro alertas em português"]);
    const tool = createForgetPreferenceTool({ memory, userId: "alice" });

    const raw = await tool.invoke({ preference: "idioma das notificações" });
    const body = JSON.parse(String(raw)) as {
      forgotten: boolean;
      fact?: string;
    };

    assert.equal(body.forgotten, true);
    assert.equal(body.fact, "prefiro alertas em português");
    assert.equal((await memory.recall("alice", "idioma")).length, 0);
  });

  it("preferência inexistente → not_found", async () => {
    const memory = new InMemoryMemoryStore();
    const tool = createForgetPreferenceTool({ memory, userId: "alice" });

    const raw = await tool.invoke({ preference: "canal slack" });
    const body = JSON.parse(String(raw)) as {
      forgotten: boolean;
      reason?: string;
    };

    assert.equal(body.forgotten, false);
    assert.equal(body.reason, "not_found");
  });
});
