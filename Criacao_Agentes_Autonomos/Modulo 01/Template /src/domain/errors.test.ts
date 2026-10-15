import assert from "node:assert/strict";
import test from "node:test";

import { DomainError, TaskNotFoundError, isDomainError } from "./errors.js";

test("TaskNotFoundError deve ser um DomainError", () => {
  const error = new TaskNotFoundError(42);

  assert.equal(error instanceof DomainError, true);
  assert.equal(error.code, "TASK_NOT_FOUND");
  assert.equal(error.message, "Task with id 42 was not found");
});

test("isDomainError deve identificar erros de dominio", () => {
  assert.equal(isDomainError(new TaskNotFoundError(1)), true);
  assert.equal(isDomainError(new Error("any")), false);
  assert.equal(isDomainError("not-an-error"), false);
});
