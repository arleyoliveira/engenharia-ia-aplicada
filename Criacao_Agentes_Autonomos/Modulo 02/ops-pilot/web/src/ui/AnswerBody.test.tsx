import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WarRoom } from "./WarRoom";
import { AnswerBody } from "./AnswerBody";

afterEach(() => {
  cleanup();
});

describe("AnswerBody", () => {
  it("renderiza cabeçalho, lista, código inline e bloco cercado", () => {
    const answer = [
      "## Status",
      "",
      "- item a",
      "- item b",
      "",
      "Use `list_alerts` para consultar.",
      "",
      "```",
      "line one",
      "line two",
      "```",
    ].join("\n");

    const { container } = render(<AnswerBody answer={answer} />);
    const root = container.querySelector(".answer-md") as HTMLElement;
    expect(root).toBeTruthy();

    expect(screen.getByRole("heading", { level: 3, name: "Status" })).toBeTruthy();
    expect(within(root).getAllByRole("listitem")).toHaveLength(2);
    expect(within(root).getByText("list_alerts").tagName).toBe("CODE");
    expect(root.querySelector("pre code")?.textContent).toContain("line one");
    expect(root.querySelector("pre code")?.textContent).toContain("line two");
    expect(screen.queryByText("## Status")).toBeNull();
  });

  it("renderiza prosa simples sem erro", () => {
    render(<AnswerBody answer="Nenhum alerta firing." />);
    expect(screen.getByText("Nenhum alerta firing.")).toBeTruthy();
  });

  it("não deixa script nem link javascript navegável", () => {
    const answer = '<script>alert(1)</script>\n\n[x](javascript:alert(1))';
    const { container } = render(<AnswerBody answer={answer} />);
    const root = container.querySelector(".answer-md");
    expect(root?.querySelector("script")).toBeNull();
    expect(root?.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it("configura link https de forma segura", () => {
    render(<AnswerBody answer="[status](https://example.com)" />);
    const link = screen.getByRole("link", { name: "status" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    const rel = link.getAttribute("rel") ?? "";
    expect(rel.includes("noopener")).toBe(true);
    expect(rel.includes("noreferrer")).toBe(true);
  });

  it("não renderiza imagem remota; mostra alt como texto", () => {
    const { container } = render(<AnswerBody answer="![alt](https://example.com/x.png)" />);
    const root = container.querySelector(".answer-md");
    expect(root?.querySelector("img")).toBeNull();
    expect(screen.getByText("alt")).toBeTruthy();
  });

  it("mapeia ### para h4, nunca h1", () => {
    render(<AnswerBody answer="### Seção" />);
    expect(screen.getByRole("heading", { level: 4, name: "Seção" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1, name: "Seção" })).toBeNull();
  });

  it("usa listas semânticas ordenada e não ordenada", () => {
    const answer = "- a\n- b\n\n1. c\n2. d";
    const { container } = render(<AnswerBody answer={answer} />);
    const root = container.querySelector(".answer-md");
    expect(root?.querySelectorAll("ul li")).toHaveLength(2);
    expect(root?.querySelectorAll("ol li")).toHaveLength(2);
  });
});

describe("AnswerBody with WarRoom", () => {
  it("mantém um único h1 na página", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          requestId: "req-md",
          conversationId: "conv-md",
          answer: "### Detalhe\n\n- um",
          trace: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const user = (await import("@testing-library/user-event")).default.setup();
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "oi");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByRole("heading", { level: 4, name: "Detalhe" });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    vi.unstubAllGlobals();
  });
});
