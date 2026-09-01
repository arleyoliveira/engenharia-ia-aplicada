import assert from "node:assert/strict";
import test from "node:test";

import {
  TASK_TITLE_MAX_LENGTH,
  TASK_TITLE_MIN_LENGTH,
  createTaskInputSchema,
  listTasksInputSchema,
  taskIdSchema,
  taskSchema
} from "./task.js";

test("createTaskInputSchema deve aplicar trim no titulo", () => {
  const parsed = createTaskInputSchema.parse({ title: "  revisar PR  " });

  assert.equal(parsed.title, "revisar PR");
});

test("createTaskInputSchema deve rejeitar titulo vazio apos trim", () => {
  assert.throws(() => createTaskInputSchema.parse({ title: "   " }));
});

test("createTaskInputSchema deve validar limite maximo de titulo", () => {
  const longTitle = "a".repeat(TASK_TITLE_MAX_LENGTH + 1);

  assert.throws(() => createTaskInputSchema.parse({ title: longTitle }));
});

test("listTasksInputSchema deve usar all como filtro padrao", () => {
  const parsed = listTasksInputSchema.parse({});

  assert.equal(parsed.filter, "all");
});

test("taskIdSchema deve aceitar apenas inteiro positivo", () => {
  assert.equal(taskIdSchema.parse(1), 1);
  assert.throws(() => taskIdSchema.parse(0));
  assert.throws(() => taskIdSchema.parse(-1));
  assert.throws(() => taskIdSchema.parse(1.2));
});

test("taskSchema deve validar tarefa completa", () => {
  const parsed = taskSchema.parse({
    id: 10,
    title: "planejar sprint",
    status: "open"
  });

  assert.equal(parsed.id, 10);
  assert.equal(parsed.title.length >= TASK_TITLE_MIN_LENGTH, true);
  assert.equal(parsed.status, "open");
});
