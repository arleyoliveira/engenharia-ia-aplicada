/**
 * Consulta status pages públicas (Statuspage.io) de provedores externos.
 * Sem autenticação; timeout 5s; um retry em rede/timeout/5xx; retorno tipado
 * para a tool serializar como observação (nunca throw para o agente).
 */
import { z } from "zod";

export type ProviderId = "github" | "cloudflare";

export const PROVIDER_STATUS_URLS = {
  github: "https://www.githubstatus.com/api/v2/status.json",
  cloudflare: "https://www.cloudflarestatus.com/api/v2/status.json",
} as const satisfies Record<ProviderId, string>;

export const providerStatusPayloadSchema = z.object({
  status: z.object({
    indicator: z.string().min(1),
    description: z.string().min(1),
  }),
});

export type ProviderStatusResult =
  | { ok: true; line: string }
  | { ok: false; error: string };

const ATTEMPT_TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 2; // 1ª + exatamente 1 retry

export type CheckProviderStatusOptions = {
  provider?: ProviderId;
  fetchImpl?: typeof fetch;
};

function fail(message: string): ProviderStatusResult {
  return { ok: false, error: `check_provider_status failed: ${message}` };
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const name = error.name;
  if (name === "AbortError" || name === "TimeoutError") return true;
  if (error instanceof TypeError) return true;
  return true;
}

async function attemptFetch(
  url: string,
  fetchImpl: typeof fetch,
): Promise<Response> {
  return fetchImpl(url, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
}

/**
 * Consulta o status público do provedor e devolve linha compacta ou erro tipado.
 * Não lança: falhas viram `{ ok: false, error }`.
 */
export async function checkProviderStatus(
  options: CheckProviderStatusOptions = {},
): Promise<ProviderStatusResult> {
  const provider: ProviderId = options.provider ?? "github";
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!(provider in PROVIDER_STATUS_URLS)) {
    return fail(`unsupported provider '${String(provider)}'`);
  }

  const url = PROVIDER_STATUS_URLS[provider];
  let lastErrorMessage = "unknown error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await attemptFetch(url, fetchImpl);

      if (response.status >= 500) {
        lastErrorMessage = `HTTP ${response.status} from ${provider}`;
        if (attempt < MAX_ATTEMPTS) continue;
        return fail(`${lastErrorMessage} after retry`);
      }

      if (!response.ok) {
        return fail(`HTTP ${response.status} from ${provider}`);
      }

      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        return fail(`invalid status payload from ${provider}`);
      }

      const parsed = providerStatusPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        return fail(`invalid status payload from ${provider}`);
      }

      const { indicator, description } = parsed.data.status;
      return {
        ok: true,
        line: `${provider}: ${indicator} — ${description}`,
      };
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : "network error";
      const retryable = isRetryableError(error);
      if (retryable && attempt < MAX_ATTEMPTS) continue;
      if (retryable && attempt >= MAX_ATTEMPTS) {
        const timedOut =
          error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError");
        return fail(
          timedOut
            ? `timeout consulting ${provider} status page`
            : `network error consulting ${provider} (${lastErrorMessage}) after retry`,
        );
      }
      return fail(`consulting ${provider}: ${lastErrorMessage}`);
    }
  }

  return fail(`could not obtain status for ${provider}`);
}
