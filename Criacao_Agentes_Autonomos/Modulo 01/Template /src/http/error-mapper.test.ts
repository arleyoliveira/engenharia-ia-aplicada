import assert from "node:assert/strict";
import test from "node:test";

import { DomainError, TaskNotFoundError } from "../domain/errors.js";
import { mapDomainErrorToHttp } from "./error-mapper.js";

test("mapDomainErrorToHttp deve mapear TASK_NOT_FOUND para 404", () => {
  const mapped = mapDomainErrorToHttp(new TaskNotFoundError(10));

  assert.equal(mapped.status, 404);
  assert.equal(mapped.body.error.code, "TASK_NOT_FOUND");
  assert.equal(mapped.body.error.message, "Task with id 10 was not found");
});

test("mapDomainErrorToHttp deve mapear erro de dominio desconhecido para 500", () => {
  class UnknownDomainError extends DomainError {
    readonly code = "UNKNOWN_DOMAIN_ERROR";

    constructor() {
      super("unknown");
    }
  }

  const mapped = mapDomainErrorToHttp(new UnknownDomainError());

  assert.equal(mapped.status, 500);
  assert.equal(mapped.body.error.code, "INTERNAL_ERROR");
});
