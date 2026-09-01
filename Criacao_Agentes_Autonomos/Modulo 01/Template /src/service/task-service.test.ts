import assert from "node:assert/strict";
import test from "node:test";

import { TaskNotFoundError } from "../domain/errors.js";
import { InMemoryTaskStore } from "../store/in-memory-task-store.js";
import { TaskService } from "./task-service.js";

test("create deve retornar tarefa com status open", () => {
  const service = new TaskService(new InMemoryTaskStore());

  const created = service.create({ title: "  revisar docs  " });

  assert.equal(created.title, "revisar docs");
  assert.equal(created.status, "open");
});

test("list deve usar filtro all como padrao", () => {
  const service = new TaskService(new InMemoryTaskStore());

  const first = service.create({ title: "primeira" });
  const second = service.create({ title: "segunda" });

  const listed = service.list();

  assert.deepEqual(listed.map((task) => task.id), [first.id, second.id]);
});

test("list deve aplicar filtro open e done", () => {
  const service = new TaskService(new InMemoryTaskStore());

  const openTask = service.create({ title: "aberta" });
  const doneTask = service.create({ title: "concluida" });
  service.complete(doneTask.id);

  const openList = service.list("open");
  const doneList = service.list("done");

  assert.deepEqual(openList.map((task) => task.id), [openTask.id]);
  assert.deepEqual(doneList.map((task) => task.id), [doneTask.id]);
});

test("complete deve ser idempotente para tarefa ja concluida", () => {
  const service = new TaskService(new InMemoryTaskStore());

  const task = service.create({ title: "finalizar" });
  const firstComplete = service.complete(task.id);
  const secondComplete = service.complete(task.id);

  assert.equal(firstComplete.status, "done");
  assert.equal(secondComplete.status, "done");
});

test("complete deve lançar TaskNotFoundError para tarefa inexistente", () => {
  const service = new TaskService(new InMemoryTaskStore());

  assert.throws(() => service.complete(999), TaskNotFoundError);
});

test("remove deve lançar TaskNotFoundError para tarefa inexistente", () => {
  const service = new TaskService(new InMemoryTaskStore());

  assert.throws(() => service.remove(999), TaskNotFoundError);
});
