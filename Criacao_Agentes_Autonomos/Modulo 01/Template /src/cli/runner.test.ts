import assert from "node:assert/strict";
import test from "node:test";

import { TaskService } from "../service/task-service.js";
import { InMemoryTaskStore } from "../store/in-memory-task-store.js";
import { runCliCommand } from "./runner.js";

function createService() {
  return new TaskService(new InMemoryTaskStore());
}

test("tasks create deve criar tarefa", () => {
  const service = createService();

  const result = runCliCommand(["tasks", "create", "--title", "  estudar zod  "], service);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout.length, 1);
  assert.equal(result.stdout[0], "Tarefa criada: 1. [open] estudar zod");
});

test("tasks list deve mostrar mensagem amigavel para lista vazia", () => {
  const service = createService();

  const result = runCliCommand(["tasks", "list"], service);

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.stdout, ["Nenhuma tarefa encontrada."]);
});

test("tasks list deve aceitar filtro done", () => {
  const service = createService();

  runCliCommand(["tasks", "create", "--title", "aberta"], service);
  runCliCommand(["tasks", "create", "--title", "concluir"], service);
  runCliCommand(["tasks", "complete", "--id", "2"], service);

  const result = runCliCommand(["tasks", "list", "--filter", "done"], service);

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.stdout, ["2. [done] concluir"]);
});

test("tasks complete deve concluir tarefa existente", () => {
  const service = createService();

  runCliCommand(["tasks", "create", "--title", "concluir"], service);
  const result = runCliCommand(["tasks", "complete", "--id", "1"], service);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout[0], "Tarefa concluída: 1. [done] concluir");
});

test("tasks remove deve remover tarefa existente", () => {
  const service = createService();

  runCliCommand(["tasks", "create", "--title", "remover"], service);
  const result = runCliCommand(["tasks", "remove", "--id", "1"], service);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout[0], "Tarefa removida: 1. [open] remover");
});

test("tasks complete deve retornar erro para tarefa inexistente", () => {
  const service = createService();

  const result = runCliCommand(["tasks", "complete", "--id", "999"], service);

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr[0], "Task with id 999 was not found");
});

test("tasks deve retornar erro para entrada invalida", () => {
  const service = createService();

  const result = runCliCommand(["tasks", "create", "--title", "   "], service);

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr[0], "Entrada inválida para o comando informado.");
});

test("comando desconhecido deve retornar erro", () => {
  const service = createService();

  const result = runCliCommand(["tasks", "unknown"], service);

  assert.equal(result.exitCode, 1);
  assert.equal(result.stderr[0], "Comando inválido. Use: tasks <create|list|complete|remove>");
});
