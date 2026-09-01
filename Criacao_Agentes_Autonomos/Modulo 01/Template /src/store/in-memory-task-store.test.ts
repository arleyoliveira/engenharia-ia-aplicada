import assert from "node:assert/strict";
import test from "node:test";

import { InMemoryTaskStore } from "./in-memory-task-store.js";

test("create deve criar tarefa com id incremental e status open", () => {
  const store = new InMemoryTaskStore();

  const first = store.create({ title: "primeira" });
  const second = store.create({ title: "segunda" });

  assert.equal(first.id, 1);
  assert.equal(first.status, "open");
  assert.equal(second.id, 2);
  assert.equal(second.status, "open");
});

test("list deve preservar ordem de criacao para all", () => {
  const store = new InMemoryTaskStore();

  const first = store.create({ title: "primeira" });
  const second = store.create({ title: "segunda" });

  const listed = store.list("all");

  assert.deepEqual(listed.map((task) => task.id), [first.id, second.id]);
});

test("list deve filtrar por open e done", () => {
  const store = new InMemoryTaskStore();

  const openTask = store.create({ title: "aberta" });
  const toComplete = store.create({ title: "concluir" });
  store.complete(toComplete.id);

  const openList = store.list("open");
  const doneList = store.list("done");

  assert.deepEqual(openList.map((task) => task.id), [openTask.id]);
  assert.deepEqual(doneList.map((task) => task.id), [toComplete.id]);
});

test("findById deve retornar tarefa quando existir", () => {
  const store = new InMemoryTaskStore();

  const created = store.create({ title: "encontrar" });
  const found = store.findById(created.id);

  assert.deepEqual(found, created);
});

test("findById deve retornar undefined quando nao existir", () => {
  const store = new InMemoryTaskStore();

  assert.equal(store.findById(999), undefined);
});

test("complete deve marcar open como done e ser idempotente", () => {
  const store = new InMemoryTaskStore();

  const created = store.create({ title: "concluir" });
  const firstComplete = store.complete(created.id);
  const secondComplete = store.complete(created.id);

  assert.equal(firstComplete?.status, "done");
  assert.equal(secondComplete?.status, "done");
  assert.equal(store.findById(created.id)?.status, "done");
});

test("complete deve retornar undefined para tarefa inexistente", () => {
  const store = new InMemoryTaskStore();

  assert.equal(store.complete(123), undefined);
});

test("remove deve excluir tarefa existente", () => {
  const store = new InMemoryTaskStore();

  const first = store.create({ title: "primeira" });
  const second = store.create({ title: "segunda" });

  const removed = store.remove(first.id);
  const listed = store.list("all");

  assert.equal(removed?.id, first.id);
  assert.deepEqual(listed.map((task) => task.id), [second.id]);
});

test("remove deve retornar undefined para tarefa inexistente", () => {
  const store = new InMemoryTaskStore();

  assert.equal(store.remove(123), undefined);
});
