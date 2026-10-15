import assert from "node:assert/strict";
import test from "node:test";

import { emptyPersistedTasks, persistedTasksSchema } from "./persisted-tasks.js";

test("persistedTasksSchema deve validar estado vazio padrao", () => {
  const parsed = persistedTasksSchema.parse(emptyPersistedTasks);

  assert.deepEqual(parsed, {
    nextId: 1,
    tasks: []
  });
});

test("persistedTasksSchema deve validar estado com tarefas", () => {
  const parsed = persistedTasksSchema.parse({
    nextId: 3,
    tasks: [
      { id: 1, title: "primeira", status: "open" },
      { id: 2, title: "segunda", status: "done" }
    ]
  });

  assert.equal(parsed.nextId, 3);
  assert.equal(parsed.tasks.length, 2);
});

test("persistedTasksSchema deve rejeitar nextId invalido", () => {
  assert.throws(() => {
    persistedTasksSchema.parse({
      nextId: 0,
      tasks: []
    });
  });
});

test("persistedTasksSchema deve rejeitar tarefa com shape invalido", () => {
  assert.throws(() => {
    persistedTasksSchema.parse({
      nextId: 2,
      tasks: [{ id: 1, title: "ok", status: "invalid" }]
    });
  });
});
