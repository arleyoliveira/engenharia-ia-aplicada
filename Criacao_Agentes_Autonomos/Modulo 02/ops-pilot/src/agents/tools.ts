/**
 * Ferramentas operacionais do agente (contracts/tools.md).
 * Argumentos validados com Zod na fronteira; retorno JSON serializado.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DomainError } from "../errors.js";
import type { AlertStore } from "../services/alert-store.js";
import { getDefaultAlertStore } from "../services/default-store.js";

const NULLISH_TOKENS = new Set(["", "none", "null", "undefined", "n/a", "na"]);

function isNullishToken(value: unknown): boolean {
  return typeof value === "string" && NULLISH_TOKENS.has(value.trim().toLowerCase());
}

function normalizeAlertStatus(value: unknown): "firing" | "resolved" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, "firing" | "resolved"> = {
    firing: "firing",
    fire: "firing",
    active: "firing",
    open: "firing",
    warning: "firing",
    disparado: "firing",
    disparando: "firing",
    critical: "firing",
    critico: "firing",
    sev1: "firing",
    sev2: "firing",
    sev3: "firing",
    sev4: "firing",
    resolved: "resolved",
    resolve: "resolved",
    ok: "resolved",
    clear: "resolved",
    normal: "resolved",
  };

  return aliases[normalized];
}

function normalizeSeverity(value: unknown): "low" | "medium" | "high" | "critical" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, "low" | "medium" | "high" | "critical"> = {
    low: "low",
    minor: "low",
    leve: "low",
    medium: "medium",
    moderate: "medium",
    sev2: "medium",
    high: "high",
    severe: "high",
    urgent: "high",
    sev3: "high",
    critical: "critical",
    critico: "critical",
    block: "critical",
    sev4: "critical",
    sev1: "low",
  };

  return aliases[normalized];
}

function failurePayload(error: unknown): string {
  if (error instanceof DomainError) {
    return JSON.stringify({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function createOpsTools(store: AlertStore) {
  const listAlerts = tool(
    async ({ status }) => {
      const normalizedStatus = isNullishToken(status)
        ? undefined
        : normalizeAlertStatus(status);
      if (status && !isNullishToken(status) && normalizedStatus === undefined) {
        throw new DomainError(
          "INVALID_STATUS",
          `status inválido: ${String(status)}. Use "firing" ou "resolved".`,
        );
      }

      return JSON.stringify({
        alerts: await store.listAlerts({ status: normalizedStatus }),
      });
    },
    {
      name: "list_alerts",
      description:
        "Lista os alertas de monitoramento. Use quando o plantonista perguntar o que está disparando, o estado dos serviços ou 'como está o plantão'. status: firing | resolved (omitir para listar todos).",
      schema: z.object({
        status: z.string().optional(),
      }),
    },
  );

  const openIncident = tool(
    async ({ title, service, severity }) => {
      try {
        const normalizedSeverity = normalizeSeverity(severity);
        if (normalizedSeverity === undefined) {
          throw new DomainError(
            "INVALID_SEVERITY",
            `severity inválida: ${String(severity)}. Use "low", "medium", "high" ou "critical".`,
          );
        }

        const incident = await store.openIncident({
          title,
          service,
          severity: normalizedSeverity,
        });
        return JSON.stringify({ incident });
      } catch (error) {
        return failurePayload(error);
      }
    },
    {
      name: "open_incident",
      description:
        "Abre um incidente de plantão vinculado a um serviço existente. severity: low | medium | high | critical.",
      schema: z.object({
        title: z.string().min(1).max(200),
        service: z.string().min(1),
        severity: z.string(),
      }),
    },
  );

  const resolveIncident = tool(
    async ({ id }) => {
      try {
        const incident = await store.resolveIncident({ id });
        return JSON.stringify({ incident });
      } catch (error) {
        return failurePayload(error);
      }
    },
    {
      name: "resolve_incident",
      description:
        "Marca um incidente como resolvido pelo identificador. Idempotente.",
      schema: z.object({
        id: z.number().int().positive(),
      }),
    },
  );

  return [listAlerts, openIncident, resolveIncident] as const;
}

/** Ferramentas padrão: MySQL quando configurado, catálogo em memória caso contrário. */
export async function createDefaultOpsTools() {
  return createOpsTools(await getDefaultAlertStore());
}
