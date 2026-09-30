import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeSecret,
  scheduleLearningRemember,
  shouldRemember,
  type LearningReflection,
} from "./learning-reflector.js";
import { InMemoryMemoryStore } from "../memory-store.js";

describe("learning-reflector", () => {
  it("preferência passa no filtro; pontual não", () => {
    const pref: LearningReflection = {
      hasLearning: true,
      fact: "Prefere alertas em português",
    };
    const pontual: LearningReflection = {
      hasLearning: false,
      fact: "",
    };
    assert.equal(shouldRemember(pref, "prefiro alertas em português"), true);
    assert.equal(shouldRemember(pontual, "liste alertas firing agora"), false);
  });

  it("rejeita fact vazio mesmo com hasLearning=true", () => {
    assert.equal(
      shouldRemember({ hasLearning: true, fact: "   " }, "oi"),
      false,
    );
  });

  it("heurística rejeita padrões de segredo", () => {
    assert.equal(looksLikeSecret("api_key=sk-abcdefghijklmnop"), true);
    assert.equal(looksLikeSecret("password: secret123"), true);
    assert.equal(looksLikeSecret("prefiro alertas em português"), false);
    assert.equal(
      shouldRemember(
        { hasLearning: true, fact: "token=abc" },
        "meu token é abc",
      ),
      false,
    );
    assert.equal(
      shouldRemember(
        { hasLearning: true, fact: "Prefere canal Slack" },
        "API key = sk-abcdefghijklmnopqrst",
      ),
      false,
    );
  });

  it("scheduleLearningRemember agenda remember só quando filtro passa", async () => {
    const memory = new InMemoryMemoryStore();
    const remembered: string[] = [];
    const originalRemember = memory.remember.bind(memory);
    memory.remember = async (userId, fact) => {
      remembered.push(fact);
      return originalRemember(userId, fact);
    };

    const tasks: Array<() => Promise<void>> = [];
    scheduleLearningRemember(
      { userId: "u1", userMessage: "prefiro PT" },
      memory,
      {
        distill: async () => ({
          hasLearning: true,
          fact: "Prefere idioma português",
        }),
        schedule: (fn) => {
          tasks.push(fn);
        },
      },
    );
    assert.equal(tasks.length, 1);
    await tasks[0]?.();
    assert.deepEqual(remembered, ["Prefere idioma português"]);

    remembered.length = 0;
    tasks.length = 0;
    scheduleLearningRemember(
      { userId: "u1", userMessage: "liste alertas" },
      memory,
      {
        distill: async () => ({ hasLearning: false, fact: "" }),
        schedule: (fn) => {
          tasks.push(fn);
        },
      },
    );
    await tasks[0]?.();
    assert.deepEqual(remembered, []);
  });
});
