// @vitest-environment node
import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("base da war room", () => {
  it("publica a sala em /opspilot/", () => {
    expect(config.base).toBe("/opspilot/");
  });
});
