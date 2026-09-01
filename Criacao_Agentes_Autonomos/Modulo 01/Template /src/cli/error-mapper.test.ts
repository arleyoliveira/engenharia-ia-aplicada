import assert from "node:assert/strict";
import test from "node:test";

import { DomainError, TaskNotFoundError } from "../domain/errors.js";
import { mapDomainErrorToCli } from "./error-mapper.js";

test("mapDomainErrorToCli deve mapear TASK_NOT_FOUND para mensagem amigavel", () => {
  const mapped = mapDomainErrorToCli(new TaskNotFoundError(8));

  assert.equal(mapped.exitCode, 1);
  assert.equal(mapped.message, "Task with id 8 was not found");
});

test("mapDomainErrorToCli deve mapear erro de dominio desconhecido para fallback", () => {
  class UnknownDomainError extends DomainError {
    readonly code = "UNKNOWN_DOMAIN_ERROR";

    constructor() {
      super("any");
    }
  }

  const mapped = mapDomainErrorToCli(new UnknownDomainError());

  assert.equal(mapped.exitCode, 1);
  assert.equal(mapped.message, "Unexpected domain error");
});
