/**
 * Fonte única de verdade das 3 tools MCP + agente: schemas Zod, descriptions e execute().
 */
import { z } from "zod";
import { DomainError } from "../errors.js";
import type { OpsStore } from "../store/ops-store.js";

export function failurePayload(error: unknown): string {
  if (error instanceof DomainError) {
    return JSON.stringify({ error: { code: error.code, message: error.message } });
  }
  throw error;
}

export function isDomainFailureJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown } };
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.error?.code === "string"
    );
  } catch {
    return false;
  }
}

export const listAlertsSchema = z.object({
  status: z
    .enum(["firing", "resolved"])
    .optional()
    .describe(
      "Filtro de status do alerta ('firing' ou 'resolved'). Omita para listar todos os alertas.",
    ),
});

export const listAlertsDescription =
  "Lista os alertas de monitoramento dos serviços. Use quando precisar verificar alertas ativos ou o estado operacional atual do sistema. Não use para listar incidentes ou consultar procedimentos de resposta. Não produz efeitos colaterais (operação de leitura). Retorna uma lista de alertas com status, serviço e título.";

export async function executeListAlerts(
  store: OpsStore,
  args: z.infer<typeof listAlertsSchema>,
): Promise<string> {
  try {
    const alerts = await store.listAlerts(args.status ? { status: args.status } : {});
    return JSON.stringify({ alerts });
  } catch (error) {
    return failurePayload(error);
  }
}

export const openIncidentSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("Título resumido e descritivo do incidente."),
  service: z
    .string()
    .min(1)
    .describe(
      "Nome do serviço afetado pelo incidente (ex: 'checkout', 'payments', 'auth').",
    ),
  severity: z
    .enum(["low", "medium", "high", "critical"])
    .describe(
      "Nível de severidade do incidente: 'low', 'medium', 'high' ou 'critical'.",
    ),
});

export const openIncidentDescription =
  "Abre um novo incidente operacional vinculado a um serviço monitorado. Use quando um alerta estiver disparando ou quando houver uma falha/degradação confirmada que exija investigação e resolução formal. Não use se o incidente já foi aberto ou se você precisa apenas consultar o estado dos serviços. Cria um novo registro de incidente no estado 'open'. Retorna o registro do incidente criado.";

export async function executeOpenIncident(
  store: OpsStore,
  args: z.infer<typeof openIncidentSchema>,
): Promise<string> {
  try {
    const incident = await store.openIncident({
      title: args.title,
      service: args.service,
      severity: args.severity,
    });
    return JSON.stringify({ incident });
  } catch (error) {
    return failurePayload(error);
  }
}

export const resolveIncidentSchema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe(
      "Identificador numérico do incidente que deve ser marcado como resolvido.",
    ),
});

export const resolveIncidentDescription =
  "Marca um incidente operacional como resolvido pelo seu identificador. Use quando o problema reportado no incidente tiver sido mitigado ou corrigido com sucesso. Não use para descartar alertas sem correção ou para incidentes inexistentes. Atualiza o status do incidente para 'resolved' e registra a data de resolução (operação idempotente). Retorna o registro do incidente atualizado.";

export async function executeResolveIncident(
  store: OpsStore,
  args: z.infer<typeof resolveIncidentSchema>,
): Promise<string> {
  try {
    const incident = await store.resolveIncident({ id: args.id });
    return JSON.stringify({ incident });
  } catch (error) {
    return failurePayload(error);
  }
}

export type McpOpsToolName =
  | "list_alerts"
  | "open_incident"
  | "resolve_incident";

export type McpOpsToolDef = {
  name: McpOpsToolName;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  execute: (store: OpsStore, args: Record<string, unknown>) => Promise<string>;
};

export const mcpOpsToolDefs: readonly McpOpsToolDef[] = [
  {
    name: "list_alerts",
    description: listAlertsDescription,
    schema: listAlertsSchema,
    execute: (store, args) =>
      executeListAlerts(store, listAlertsSchema.parse(args)),
  },
  {
    name: "open_incident",
    description: openIncidentDescription,
    schema: openIncidentSchema,
    execute: (store, args) =>
      executeOpenIncident(store, openIncidentSchema.parse(args)),
  },
  {
    name: "resolve_incident",
    description: resolveIncidentDescription,
    schema: resolveIncidentSchema,
    execute: (store, args) =>
      executeResolveIncident(store, resolveIncidentSchema.parse(args)),
  },
] as const;

export const MCP_OPS_TOOL_NAMES = mcpOpsToolDefs.map((d) => d.name);
