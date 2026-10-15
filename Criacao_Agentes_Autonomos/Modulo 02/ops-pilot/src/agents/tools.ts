/**
 * Ferramentas operacionais do agente (contracts/tools.md).
 * Argumentos validados com Zod na fronteira; retorno JSON serializado.
 * Todas as descrições seguem as 6 regras (o que faz, quando usar, quando não usar,
 * efeitos colaterais, retorno e parâmetros com .describe()).
 *
 * As 3 tools compartilhadas com MCP vêm de ops-tool-defs (fonte única).
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { DomainError } from "../errors.js";
import type { AlertStore } from "../services/alert-store.js";
import type { OpsStore } from "../store/ops-store.js";
import { getDefaultOpsStore } from "../services/default-store.js";
import { checkProviderStatus } from "../services/provider-status.js";
import {
  executeListAlerts,
  executeOpenIncident,
  executeResolveIncident,
  failurePayload,
  listAlertsDescription,
  listAlertsSchema,
  openIncidentDescription,
  openIncidentSchema,
  resolveIncidentDescription,
  resolveIncidentSchema,
} from "./ops-tool-defs.js";

export type OpsToolsDeps = {
  fetchImpl?: typeof fetch;
};

export function createOpsTools(
  store: AlertStore | OpsStore | any,
  deps: OpsToolsDeps = {},
) {
  const fetchImpl = deps.fetchImpl;
  const listAlerts = tool(
    async (args) => executeListAlerts(store, args),
    {
      name: "list_alerts",
      description: listAlertsDescription,
      schema: listAlertsSchema,
    },
  );

  const openIncident = tool(
    async (args) => executeOpenIncident(store, args),
    {
      name: "open_incident",
      description: openIncidentDescription,
      schema: openIncidentSchema,
    },
  );

  const resolveIncident = tool(
    async (args) => executeResolveIncident(store, args),
    {
      name: "resolve_incident",
      description: resolveIncidentDescription,
      schema: resolveIncidentSchema,
    },
  );

  const listIncidents = tool(
    async ({ status }) => {
      try {
        const incidents = (await store.listIncidents?.(status)) ?? [];
        return JSON.stringify({ incidents });
      } catch (error) {
        return failurePayload(error);
      }
    },
    {
      name: "list_incidents",
      description:
        "Lista os incidentes operacionais registrados no sistema. Use quando precisar consultar o histórico de incidentes, verificar incidentes em andamento ou listar os resolvidos. Não use para consultar alertas de monitoramento ou runbooks de serviços. Não produz efeitos colaterais (operação de leitura). Retorna um array de incidentes com id, título, serviço, severidade, status e datas de criação/resolução.",
      schema: z.object({
        status: z
          .enum(["open", "resolved", "all"])
          .default("open")
          .describe("Filtro de status do incidente: 'open' (padrão), 'resolved' ou 'all'."),
      }),
    },
  );

  const consultarRunbook = tool(
    async ({ service }) => {
      try {
        const runbook = await store.getRunbook?.(service);
        if (!runbook) {
          throw new DomainError("NOT_FOUND", `Runbook não encontrado para o serviço: ${service}`);
        }
        return JSON.stringify({ runbook });
      } catch (error) {
        return failurePayload(error);
      }
    },
    {
      name: "consultar_runbook",
      description:
        "Consulta o procedimento operacional (runbook) documentado para um serviço. Use quando precisar de instruções passo a passo para investigar ou mitigar falhas em um serviço específico. Não use para listar alertas ou abrir novos incidentes. Não produz efeitos colaterais (operação de leitura). Retorna o objeto do runbook contendo id, serviço, nome e os passos detalhados.",
      schema: z.object({
        service: z
          .string()
          .min(1)
          .describe("Nome do serviço cujo runbook operacional deve ser consultado (ex: 'checkout', 'payments', 'auth')."),
      }),
    },
  );

  const checkProviderStatusTool = tool(
    async ({ provider }) => {
      try {
        const result = await checkProviderStatus({
          provider,
          fetchImpl,
        });
        return result.ok ? result.line : result.error;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unexpected error";
        return `check_provider_status failed: ${message}`;
      }
    },
    {
      name: "check_provider_status",
      description:
        "Consulta a status page pública de um provedor externo (GitHub ou Cloudflare), sem autenticação. Use quando houver suspeita de problema externo, a pergunta for “é o nosso ou do provedor?” ou uma dependência parecer fora do ar. Não use para listar alertas/incidentes internos do OpsPilot nem para abrir/resolver incidente. Somente leitura HTTP externa (sem mutação local). Retorna uma linha compacta `provider: indicator — description`, ou mensagem de erro legível se a consulta falhar.",
      schema: z.object({
        provider: z
          .enum(["github", "cloudflare"])
          .default("github")
          .describe(
            "Provedor externo cuja status page pública será consultada. Use 'github' (padrão) ou 'cloudflare'.",
          ),
      }),
    },
  );

  return [
    listAlerts,
    openIncident,
    resolveIncident,
    listIncidents,
    consultarRunbook,
    checkProviderStatusTool,
  ] as const;
}

/** Ferramentas padrão: SQLite embarcado (SqliteOpsStore) com catálogo pré-semeado. */
export async function createDefaultOpsTools() {
  return createOpsTools(await getDefaultOpsStore());
}
