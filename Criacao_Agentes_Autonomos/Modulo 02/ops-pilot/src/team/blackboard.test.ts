import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendAction,
  appendBrief,
  appendFindings,
  emptyBlackboard,
  replacePlan,
} from "./blackboard.js";

describe("blackboard", () => {
  it("começa vazio e cada papel escreve só o seu campo", () => {
    const empty = emptyBlackboard();
    assert.equal(empty.findings, "");
    assert.equal(empty.plan, "");
    assert.deepEqual(empty.actions, []);
    assert.deepEqual(empty.briefs, []);

    const once = appendFindings(empty, "alerta firing");
    const twice = appendFindings(once, "incidente aberto");
    assert.equal(twice.findings, "alerta firing\nincidente aberto");
    assert.equal(twice.plan, "");
    assert.deepEqual(twice.actions, []);

    const planned = replacePlan(twice, "1. abrir incidente");
    assert.equal(planned.plan, "1. abrir incidente");
    assert.equal(planned.findings, twice.findings);

    const acted = appendAction(planned, {
      tool: "open_incident",
      args: { title: "checkout" },
      observation: '{"id":"1"}',
    });
    assert.equal(acted.actions.length, 1);
    assert.equal(acted.plan, planned.plan);
    assert.equal(acted.findings, planned.findings);

    const briefed = appendBrief(acted, { next: "done", brief: "encerrado" });
    assert.deepEqual(briefed.briefs, [{ next: "done", brief: "encerrado" }]);
    assert.equal(briefed.actions.length, 1);
  });
});
