import { describe, expect, it } from "vitest";
import { isSafeHref, markdownHeadingTag } from "./answer-markdown";

describe("markdownHeadingTag", () => {
  it("desloca níveis para não usar h1 na página", () => {
    expect(markdownHeadingTag(1)).toBe("h2");
    expect(markdownHeadingTag(2)).toBe("h3");
    expect(markdownHeadingTag(3)).toBe("h4");
    expect(markdownHeadingTag(4)).toBe("h4");
    expect(markdownHeadingTag(6)).toBe("h4");
  });
});

describe("isSafeHref", () => {
  it("aceita http e https", () => {
    expect(isSafeHref("https://example.com/path")).toBe(true);
    expect(isSafeHref("http://localhost:3000/chat")).toBe(true);
  });

  it("rejeita javascript, vazio e esquemas desconhecidos", () => {
    expect(isSafeHref("")).toBe(false);
    expect(isSafeHref("   ")).toBe(false);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,evil")).toBe(false);
    expect(isSafeHref("ftp://files.example.com")).toBe(false);
  });
});
