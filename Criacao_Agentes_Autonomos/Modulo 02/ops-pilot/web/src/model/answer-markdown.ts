export type AnswerHeadingTag = "h2" | "h3" | "h4";

/** Maps Markdown heading depth (1 = `#`) to DOM tag inside the answer bubble. */
export function markdownHeadingTag(depth: number): AnswerHeadingTag {
  if (depth <= 1) {
    return "h2";
  }
  if (depth === 2) {
    return "h3";
  }
  return "h4";
}

export function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (trimmed.length === 0) {
    return false;
  }
  try {
    const url = new URL(trimmed, "https://example.com");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
