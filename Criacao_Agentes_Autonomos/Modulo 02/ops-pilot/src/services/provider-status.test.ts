import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROVIDER_STATUS_URLS,
  checkProviderStatus,
} from "./provider-status.js";

type FakeHandler = (
  url: string,
  init?: RequestInit,
) => Promise<Response> | Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status });
}

function makeFakeFetch(handlers: FakeHandler[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const handler = handlers[Math.min(calls.length - 1, handlers.length - 1)]!;
    return handler(url, init);
  };
  return { fetchImpl, calls };
}

const githubOk = {
  status: { indicator: "none", description: "All Systems Operational" },
};

const cloudflareDegraded = {
  status: {
    indicator: "major",
    description: "Cloudflare is investigating elevated error rates",
  },
};

describe("checkProviderStatus", () => {
  it("sucesso GitHub com provider omitido (default) → linha compacta", async () => {
    const { fetchImpl, calls } = makeFakeFetch([() => jsonResponse(githubOk)]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.line, "github: none — All Systems Operational");
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, PROVIDER_STATUS_URLS.github);
  });

  it("sucesso Cloudflare → linha compacta", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => jsonResponse(cloudflareDegraded),
    ]);
    const result = await checkProviderStatus({
      provider: "cloudflare",
      fetchImpl,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        result.line,
        "cloudflare: major — Cloudflare is investigating elevated error rates",
      );
    }
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, PROVIDER_STATUS_URLS.cloudflare);
  });

  it("timeout → erro legível após retry (2 tentativas)", async () => {
    const abort = () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    };
    const { fetchImpl, calls } = makeFakeFetch([abort, abort]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /check_provider_status failed:/);
      assert.match(result.error, /timeout/i);
    }
    assert.equal(calls.length, 2);
  });

  it("5xx na 1ª + sucesso na 2ª → linha compacta (exatamente 1 retry)", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => textResponse("unavailable", 503),
      () => jsonResponse(githubOk),
    ]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.line, "github: none — All Systems Operational");
    }
    assert.equal(calls.length, 2);
  });

  it("5xx em ambas → erro legível após retry", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => textResponse("unavailable", 503),
      () => textResponse("still down", 502),
    ]);
    const result = await checkProviderStatus({
      provider: "cloudflare",
      fetchImpl,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /check_provider_status failed:/);
      assert.match(result.error, /502|503|after retry/);
    }
    assert.equal(calls.length, 2);
  });

  it("falha de rede na 1ª + sucesso na 2ª → linha compacta", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => {
        throw new TypeError("fetch failed");
      },
      () => jsonResponse(githubOk),
    ]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.line, /^github:/);
    }
    assert.equal(calls.length, 2);
  });

  it("HTTP 4xx → erro legível sem retry", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => textResponse("not found", 404),
    ]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /HTTP 404/);
    }
    assert.equal(calls.length, 1);
  });

  it("JSON inválido → erro de validação sem retry", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => textResponse("not-json{", 200),
    ]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /invalid status payload/);
    }
    assert.equal(calls.length, 1);
  });

  it("payload sem indicator/description → erro sem retry", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      () => jsonResponse({ status: { indicator: "" } }),
    ]);
    const result = await checkProviderStatus({ fetchImpl });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /invalid status payload/);
    }
    assert.equal(calls.length, 1);
  });

  it("nunca usa globalThis.fetch quando fetchImpl é injetado", async () => {
    let realFetchCalled = false;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      realFetchCalled = true;
      throw new Error("rede real não deveria ser chamada");
    }) as typeof fetch;

    try {
      const { fetchImpl, calls } = makeFakeFetch([
        () => jsonResponse(githubOk),
      ]);
      await checkProviderStatus({ fetchImpl });
      assert.equal(realFetchCalled, false);
      assert.equal(calls.length, 1);
      assert.ok(calls[0]!.url.includes("githubstatus.com"));
    } finally {
      globalThis.fetch = original;
    }
  });
});
