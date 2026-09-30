import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WarRoom } from "./WarRoom";

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("WarRoom", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra a sala vazia, a resposta e a conversa seguinte", async () => {
    const user = userEvent.setup();
    render(<WarRoom />);
    expect(screen.getByText("Nenhuma mensagem ainda")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    await user.type(screen.getByLabelText("Mensagem"), "   ");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("A mensagem não pode ficar vazia.")).toBeTruthy();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-1",
      conversationId: "conv-1",
      answer: "Resposta pronta",
      trace: [],
    }));
    await user.clear(screen.getByLabelText("Mensagem"));
    await user.type(screen.getByLabelText("Mensagem"), "status do billing");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Resposta pronta")).toBeTruthy();
    expect(screen.getByText("req-1")).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      message: "status do billing",
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-2",
      conversationId: "conv-1",
      answer: "Segunda",
      trace: [],
    }));
    await user.type(screen.getByLabelText("Mensagem"), "de novo");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Segunda")).toBeTruthy();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3000/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      message: "de novo",
      conversationId: "conv-1",
    });
  });

  it("não dispara um segundo envio enquanto o pedido está em voo", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "aguardar");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByText("Enviando…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(jsonResponse(200, {
      requestId: "req-wait",
      conversationId: "conv-wait",
      answer: "chegou",
      trace: [],
    }));
    expect(await screen.findByText("chegou")).toBeTruthy();
  });

  it("mostra erro de alcance e tenta de novo sem apagar o fio", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-ok",
      conversationId: "conv-ok",
      answer: "antes",
      trace: [],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "primeiro");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("antes")).toBeTruthy();

    fetchMock.mockRejectedValueOnce(new Error("offline"));
    await user.type(screen.getByLabelText("Mensagem"), "depois");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Não foi possível alcançar a API.")).toBeTruthy();
    expect(screen.getByText("antes")).toBeTruthy();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-retry",
      conversationId: "conv-ok",
      answer: "de novo deu certo",
      trace: [],
    }));
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("de novo deu certo")).toBeTruthy();
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual({
      message: "depois",
      conversationId: "conv-ok",
    });
  });

  it("abre o raciocínio tipado e o fecha sem novo pedido", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-trace",
      conversationId: "conv-trace",
      answer: "com trace",
      trace: [
        { type: "thought", content: "pensei" },
        { type: "action", tool: "list_alerts", args: { service: "billing" } },
      ],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "rastrear");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    const toggle = await screen.findByRole("button", { name: "ver raciocínio" });
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", { name: "Raciocínio" });
    const text = panel.textContent ?? "";
    expect(text.indexOf("pensei")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("pensei")).toBeLessThan(text.indexOf("list_alerts"));
    expect(text.indexOf("list_alerts")).toBeLessThan(text.indexOf("billing"));
    await user.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mostra o handoff e fecha sem novo pedido", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-handoff",
      conversationId: "conv-handoff",
      answer: "equipe",
      trace: [
        { type: "thought", content: "pensei" },
        { type: "handoff", from: "supervisor", to: "executor", brief: "abrir incidente", node: "supervisor" },
      ],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "equipe");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    const toggle = await screen.findByRole("button", { name: "ver raciocínio" });
    await user.click(toggle);
    const panel = screen.getByRole("region", { name: "Raciocínio" });
    const text = panel.textContent ?? "";
    expect(text.indexOf("pensei")).toBeGreaterThanOrEqual(0);
    expect(text.indexOf("pensei")).toBeLessThan(text.indexOf("executor"));
    expect(text.indexOf("executor")).toBeLessThan(text.indexOf("abrir incidente"));
    await user.click(toggle);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explica trace vazio", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-empty",
      conversationId: "conv-empty",
      answer: "sem trace",
      trace: [],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "vazio");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await user.click(await screen.findByRole("button", { name: "ver raciocínio" }));
    expect(screen.getByText("Não há eventos de raciocínio neste turno.")).toBeTruthy();
  });

  it("transforma 202 em cartão e envia uma única decisão", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(202, {
      requestId: "req-202",
      conversationId: "conv-202",
      pendingAction: { summary: "Abrir incidente no billing" },
      trace: [],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "agir");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Abrir incidente no billing")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    const approve = screen.getByRole("button", { name: "Aprovar" });
    expect(screen.getByRole("button", { name: "Negar" })).toBeTruthy();

    let resolveDecision: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveDecision = resolve;
    }));
    fireEvent.click(approve);
    fireEvent.click(approve);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      conversationId: "conv-202",
      decision: "approve",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).message).toBeUndefined();
    resolveDecision(jsonResponse(200, {
      requestId: "req-done",
      conversationId: "conv-202",
      answer: "incidente aberto",
      trace: [],
    }));
    expect(await screen.findByText("incidente aberto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aprovar" })).toBeNull();
  });

  it("nega com decision deny e usa o texto padrão sem resumo", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(202, {
      requestId: "req-plain",
      conversationId: "conv-plain",
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "sem resumo");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Ação aguardando decisão")).toBeTruthy();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-denied",
      conversationId: "conv-plain",
      answer: "não feito",
      trace: [],
    }));
    await user.click(screen.getByRole("button", { name: "Negar" }));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      conversationId: "conv-plain",
      decision: "deny",
    });
    expect(await screen.findByText("não feito")).toBeTruthy();
  });

  it("guarda a URL da engrenagem e rejeita valor inválido", async () => {
    const user = userEvent.setup();
    const view = render(<WarRoom />);
    await user.click(screen.getByRole("button", { name: "Configurar URL da API" }));
    const field = screen.getByLabelText("URL da API");
    await user.clear(field);
    await user.type(field, "http://127.0.0.1:9090/");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-url",
      conversationId: "conv-url",
      answer: "na outra porta",
      trace: [],
    }));
    await user.type(screen.getByLabelText("Mensagem"), "ping");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("na outra porta")).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://127.0.0.1:9090/chat");

    view.unmount();
    render(<WarRoom />);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-url-2",
      conversationId: "conv-url",
      answer: "ainda lá",
      trace: [],
    }));
    await user.type(screen.getByLabelText("Mensagem"), "de novo");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://127.0.0.1:9090/chat");

    await user.click(screen.getByRole("button", { name: "Configurar URL da API" }));
    const nextField = screen.getByLabelText("URL da API");
    await user.clear(nextField);
    await user.type(nextField, "não é url");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(screen.getByText("Informe uma URL absoluta http ou https.")).toBeTruthy();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-url-3",
      conversationId: "conv-url",
      answer: "mesma base",
      trace: [],
    }));
    await user.type(screen.getByLabelText("Mensagem"), "segue");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("http://127.0.0.1:9090/chat");
  });

  it("formata answer Markdown e mantém o corpo ao abrir o raciocínio", async () => {
    const user = userEvent.setup();
    const markdownAnswer = ["## Status", "", "- item a", "- item b"].join("\n");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-md",
      conversationId: "conv-md",
      answer: markdownAnswer,
      trace: [{ type: "thought", content: "analise" }],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "status");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Status" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    const toggle = screen.getByRole("button", { name: "ver raciocínio" });
    await user.click(toggle);
    expect(screen.getByRole("region", { name: "Raciocínio" }).textContent).toContain("analise");
    expect(screen.getByRole("heading", { level: 3, name: "Status" })).toBeTruthy();
    await user.click(toggle);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não interpreta Markdown na mensagem do plantonista", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "req-user-md",
      conversationId: "conv-user-md",
      answer: "ok",
      trace: [],
    }));
    render(<WarRoom />);
    await user.type(screen.getByLabelText("Mensagem"), "**urgente**");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("**urgente**")).toBeTruthy();
    expect(screen.queryByText("urgente", { selector: "strong" })).toBeNull();
  });

  it("persiste o tema e aciona os controles pelo teclado", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(202, {
        requestId: "req-key",
        conversationId: "conv-key",
        pendingAction: { summary: "Reiniciar o worker" },
        trace: [{ type: "thought", content: "avaliar" }],
      }))
      .mockResolvedValueOnce(jsonResponse(202, {
        requestId: "req-key-2",
        conversationId: "conv-key",
        pendingAction: { summary: "Segundo passo" },
        trace: [],
      }))
      .mockResolvedValueOnce(jsonResponse(200, {
        requestId: "req-key-3",
        conversationId: "conv-key",
        answer: "concluído",
        trace: [],
      }));
    const view = render(<WarRoom />);
    const gear = screen.getByRole("button", { name: "Configurar URL da API" });
    gear.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("URL da API")).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Sistema" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    await user.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("opspilot.theme")).toBe("dark");

    await user.type(screen.getByLabelText("Mensagem"), "agir");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    const reasoning = await screen.findByRole("button", { name: "ver raciocínio" });
    reasoning.focus();
    await user.keyboard("{Enter}");
    expect(reasoning.getAttribute("aria-expanded")).toBe("true");

    screen.getByRole("button", { name: "Negar" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Segundo passo")).toBeTruthy();
    screen.getByRole("button", { name: "Aprovar" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("concluído")).toBeTruthy();

    view.unmount();
    render(<WarRoom />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
