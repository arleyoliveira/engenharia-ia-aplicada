/**
 * Benchmark do OpsPilot: avalia estratégias (react, plan-and-execute) em 3 cenários
 * operacionais com validação do acerto diretamente no ESTADO do store.
 *
 * Suporta flags CLI:
 *   --scenario (ex.: 1, 2, 3, c1, c2, c3, c1,c2 ou all)
 *   --no-replanner (desativa o nó de replanner no plan-and-execute)
 *   --strategies (padrão: react,plan-and-execute)
 *   --max-iterations (padrão: 8)
 */
import process from "node:process";
import { parseArgs } from "node:util";
import { z } from "zod";
import { DomainError, toBoundaryMessage } from "./errors.js";
import { createReactStrategy } from "./agents/react.js";
import { createPlanAndExecuteStrategy } from "./agents/plan-and-execute.js";
import { createOpsTools } from "./agents/tools.js";
import { formatTrace, summarizeMetrics } from "./agents/trace.js";
import type { ReasoningStrategy, StrategyResult } from "./agents/types.js";
import {
  createAlertStore,
  type AlertStore,
  type StoreRepos,
} from "./services/alert-store.js";
import { createMemoryRepos, type MemoryState } from "./services/alert-store.memory.js";

export interface BenchmarkScenario {
  id: "C1" | "C2" | "C3";
  name: string;
  description: string;
  prompt: string;
  setupStore: () => Promise<{
    store: AlertStore;
    repos: StoreRepos & { state: MemoryState };
  }>;
  verify: (context: {
    result: StrategyResult;
    store: AlertStore;
    repos: StoreRepos & { state: MemoryState };
  }) => Promise<{ success: boolean; details: string }>;
}

export interface BenchmarkRow {
  scenario: string;
  strategy: string;
  success: boolean;
  llmCalls: number;
  latencyMs: number;
  details: string;
}

/** Cenário 1: Consulta direta — verifica que o store não foi alterado e resposta acertou o número */
const scenario1: BenchmarkScenario = {
  id: "C1",
  name: "C1 direto",
  description: "quantos alertas críticos estão disparando?",
  prompt: "quantos alertas críticos estão disparando?",
  async setupStore() {
    const repos = createMemoryRepos();
    const store = createAlertStore(repos);

    await store.ensureService("api-gateway");
    await store.ensureService("auth-service");
    await store.ensureService("billing");
    await store.ensureService("notifications");
    await store.ensureService("search");

    await store.ensureAlert({
      service: "api-gateway",
      title: "Latência p95 acima de 2s",
      status: "firing",
    });
    await store.ensureAlert({
      service: "auth-service",
      title: "Taxa de erro 5xx > 5%",
      status: "firing",
    });
    await store.ensureAlert({
      service: "billing",
      title: "Fila de pagamentos acumulando",
      status: "firing",
    });
    await store.ensureAlert({
      service: "notifications",
      title: "Envio de e-mails normalizado",
      status: "resolved",
    });
    await store.ensureAlert({
      service: "search",
      title: "Índice reconstruído",
      status: "resolved",
    });
    await store.ensureAlert({
      service: "api-gateway",
      title: "Deploy concluído sem erros",
      status: "resolved",
    });

    return { store, repos };
  },
  async verify({ result, repos }) {
    const incidentsCount = repos.state.incidents.length;
    const mentionsThree = /\b3\b|tr[eê]s/i.test(result.answer);

    if (incidentsCount === 0 && mentionsThree) {
      return {
        success: true,
        details: "Nenhum incidente criado indevidamente e identificou 3 alertas em firing.",
      };
    }

    const reasons: string[] = [];
    if (incidentsCount > 0) {
      reasons.push(`${incidentsCount} incidente(s) foram criados em consulta somente-leitura`);
    }
    if (!mentionsThree) {
      reasons.push("resposta não indicou a contagem correta de 3 alertas");
    }

    return {
      success: false,
      details: reasons.join("; "),
    };
  },
};

/** Cenário 2: Sequência estruturada — 3 incidentes criados na ordem e o primeiro resolvido */
const scenario2: BenchmarkScenario = {
  id: "C2",
  name: "C2 estruturado",
  description: "abra três incidentes de sev2 para checkout, payment e calalog, nessa mesma ordem e resolva o primeiro.",
  prompt:
    "abra três incidentes de sev2 para checkout, payment e calalog, nessa mesma ordem e resolva o primeiro.",
  async setupStore() {
    const repos = createMemoryRepos();
    const store = createAlertStore(repos);

    await store.ensureService("checkout");
    await store.ensureService("payment");
    await store.ensureService("payments");
    await store.ensureService("catalog");
    await store.ensureService("calalog");

    await store.ensureAlert({
      service: "checkout",
      title: "Erro 500 no checkout",
      status: "firing",
    });
    await store.ensureAlert({
      service: "payment",
      title: "Timeout no processamento de pagamentos",
      status: "firing",
    });
    await store.ensureAlert({
      service: "catalog",
      title: "Catálogo de produtos instável",
      status: "firing",
    });

    return { store, repos };
  },
  async verify({ repos }) {
    const incidents = repos.state.incidents;
    if (incidents.length < 3) {
      return {
        success: false,
        details: `Esperado 3 incidentes criados, mas foram encontrados ${incidents.length}.`,
      };
    }

    const first = incidents[0]!;
    const second = incidents[1]!;
    const third = incidents[2]!;

    const firstService = (await repos.serviceName(first.serviceId)).toLowerCase();
    const secondService = (await repos.serviceName(second.serviceId)).toLowerCase();
    const thirdService = (await repos.serviceName(third.serviceId)).toLowerCase();

    const isFirstResolved = first.status === "resolved" && first.resolvedAt !== null;
    const isSecondOpen = second.status === "open";
    const isThirdOpen = third.status === "open";

    const isFirstCheckout = firstService.includes("checkout");
    const isSecondPayment = secondService.includes("pay");
    const isThirdCatalog = thirdService.includes("cat") || thirdService.includes("cal");

    const severitiesOk =
      first.severity === "medium" &&
      second.severity === "medium" &&
      third.severity === "medium";

    const success =
      isFirstResolved &&
      isSecondOpen &&
      isThirdOpen &&
      isFirstCheckout &&
      isSecondPayment &&
      isThirdCatalog;

    if (success) {
      return {
        success: true,
        details:
          "3 incidentes criados na ordem (checkout, payment, catalog) e o primeiro resolvido.",
      };
    }

    const errors: string[] = [];
    if (!isFirstCheckout) errors.push(`1º incidente esperado 'checkout', obtido '${firstService}'`);
    if (!isSecondPayment) errors.push(`2º incidente esperado 'payment', obtido '${secondService}'`);
    if (!isThirdCatalog) errors.push(`3º incidente esperado 'catalog', obtido '${thirdService}'`);
    if (!isFirstResolved) errors.push("1º incidente não foi marcado como resolvido");
    if (!isSecondOpen) errors.push("2º incidente não está com status aberto");
    if (!isThirdOpen) errors.push("3º incidente não está com status aberto");
    if (!severitiesOk) errors.push("severidade sev2 (medium) não foi aplicada a todos");

    return {
      success: false,
      details: errors.join("; "),
    };
  },
};

/** Cenário 3: Dinâmico — abre incidente para o alerta mais antigo e informa quantos restaram */
const scenario3: BenchmarkScenario = {
  id: "C3",
  name: "C3 dinâmico",
  description: "dos alertas disparando, abra um incidente para o mais antigo e diga quantos sobraram",
  prompt: "dos alertas disparando, abra um incidente para o mais antigo e diga quantos sobraram",
  async setupStore() {
    const repos = createMemoryRepos();
    const store = createAlertStore(repos);

    await store.ensureService("api-gateway");
    await store.ensureService("auth-service");
    await store.ensureService("billing");
    await store.ensureService("notifications");

    // id 1: mais antigo disparando
    await store.ensureAlert({
      service: "api-gateway",
      title: "Latência p95 acima de 2s",
      status: "firing",
    });
    // id 2: disparando
    await store.ensureAlert({
      service: "auth-service",
      title: "Taxa de erro 5xx > 5%",
      status: "firing",
    });
    // id 3: disparando
    await store.ensureAlert({
      service: "billing",
      title: "Fila de pagamentos acumulando",
      status: "firing",
    });
    // id 4: resolvido
    await store.ensureAlert({
      service: "notifications",
      title: "Envio de e-mails normalizado",
      status: "resolved",
    });

    return { store, repos };
  },
  async verify({ result, repos }) {
    const incidents = repos.state.incidents;
    const mentionsTwo = /\b2\b|dois|duas/i.test(result.answer);

    if (incidents.length !== 1) {
      return {
        success: false,
        details: `Esperado exatamente 1 incidente aberto, encontrados ${incidents.length}.`,
      };
    }

    const created = incidents[0]!;
    const serviceName = (await repos.serviceName(created.serviceId)).toLowerCase();
    const isOldestService = serviceName === "api-gateway";

    if (isOldestService && created.status === "open" && mentionsTwo) {
      return {
        success: true,
        details: "1 incidente aberto para o alerta mais antigo (api-gateway) e informou 2 restantes.",
      };
    }

    const errors: string[] = [];
    if (!isOldestService) {
      errors.push(`incidente aberto para serviço '${serviceName}' em vez do mais antigo 'api-gateway'`);
    }
    if (created.status !== "open") {
      errors.push(`status do incidente é '${created.status}' (esperado 'open')`);
    }
    if (!mentionsTwo) {
      errors.push("resposta não informou que sobraram 2 alertas");
    }

    return {
      success: false,
      details: errors.join("; "),
    };
  },
};

export const ALL_SCENARIOS: BenchmarkScenario[] = [
  scenario1,
  scenario2,
  scenario3,
];

const cliSchema = z.object({
  scenario: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim().toLowerCase() === "all") return null;
      return val
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }),
  strategies: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return ["react", "plan-and-execute"];
      return val.split(",").map((s) => s.trim().toLowerCase());
    }),
  "no-replanner": z.boolean().default(false),
  "max-iterations": z.coerce.number().int().positive().default(8),
});

function renderAsciiTable(rows: BenchmarkRow[]): string {
  const headers = ["Cenário", "Estratégia", "Acerto", "llmCalls", "latencyMs"];

  const colWidths = [
    Math.max(headers[0]!.length, ...rows.map((r) => r.scenario.length)),
    Math.max(headers[1]!.length, ...rows.map((r) => r.strategy.length)),
    Math.max(headers[2]!.length, ...rows.map((r) => (r.success ? "SIM" : "NÃO").length)),
    Math.max(headers[3]!.length, ...rows.map((r) => String(r.llmCalls).length)),
    Math.max(headers[4]!.length, ...rows.map((r) => `${r.latencyMs}ms`.length)),
  ];

  const pad = (str: string, len: number) => str.padEnd(len, " ");
  const padRight = (str: string, len: number) => str.padStart(len, " ");

  const topBorder = `┌─${colWidths.map((w) => "─".repeat(w)).join("─┬─")}─┐`;
  const midBorder = `├─${colWidths.map((w) => "─".repeat(w)).join("─┼─")}─┤`;
  const botBorder = `└─${colWidths.map((w) => "─".repeat(w)).join("─┴─")}─┘`;

  const headerRow = `│ ${headers
    .map((h, i) => pad(h, colWidths[i]!))
    .join(" │ ")} │`;

  const dataRows = rows.map((r) => {
    const acertoText = r.success ? "SIM" : "NÃO";
    return `│ ${pad(r.scenario, colWidths[0]!)} │ ${pad(
      r.strategy,
      colWidths[1]!,
    )} │ ${pad(acertoText, colWidths[2]!)} │ ${padRight(
      String(r.llmCalls),
      colWidths[3]!,
    )} │ ${padRight(`${r.latencyMs}ms`, colWidths[4]!)} │`;
  });

  return [topBorder, headerRow, midBorder, ...dataRows, botBorder].join("\n");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

export async function runBenchmark(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scenario: { type: "string" },
      strategies: { type: "string" },
      "no-replanner": { type: "boolean" },
      "max-iterations": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    console.log(`
Uso: npm run bench -- [opções]

Opções:
  --scenario <id>        Filtra cenários para executar (ex: 1, 2, 3, c1, c2, c3, c1,c2 ou all)
  --no-replanner         Desativa o nó de replanner na estratégia plan-and-execute
  --strategies <lista>   Estratégias a avaliar (padrão: react,plan-and-execute)
  --max-iterations <N>   Limite máximo de iterações por estratégia (padrão: 8)
  -h, --help             Exibe esta mensagem de ajuda
`);
    return;
  }

  const parsed = cliSchema.safeParse({
    scenario: values.scenario,
    strategies: values.strategies,
    "no-replanner": values["no-replanner"] ?? false,
    "max-iterations": values["max-iterations"] ?? 8,
  });

  if (!parsed.success) {
    fail(`Argumentos inválidos: ${parsed.error.issues[0]?.message}`);
  }

  const {
    scenario: selectedFilters,
    strategies: strategyNames,
    "no-replanner": noReplanner,
    "max-iterations": maxIterations,
  } = parsed.data;

  const scenariosToRun = ALL_SCENARIOS.filter((sc) => {
    if (!selectedFilters) return true;
    return selectedFilters.some(
      (f: string) =>
        f === sc.id.toLowerCase() ||
        f === sc.id.replace("c", "").toLowerCase() ||
        sc.name.toLowerCase().includes(f),
    );
  });

  if (scenariosToRun.length === 0) {
    fail(
      `Nenhum cenário encontrado para o filtro fornecido: "${values.scenario}". Cenários disponíveis: C1, C2, C3.`,
    );
  }

  console.log("==================================================================");
  console.log("                      OPSPILOT BENCHMARK                          ");
  console.log("==================================================================");
  console.log(`Cenários a executar : ${scenariosToRun.map((s) => s.id).join(", ")}`);
  console.log(`Estratégias         : ${strategyNames.join(", ")}`);
  console.log(`No-Replanner        : ${noReplanner ? "ATIVADO" : "DESATIVADO"}`);
  console.log(`Max Iterations      : ${maxIterations}`);
  console.log("==================================================================\n");

  const results: BenchmarkRow[] = [];

  for (const scenario of scenariosToRun) {
    console.log(`\n▶ [${scenario.id}] ${scenario.name}: "${scenario.prompt}"`);
    console.log("─".repeat(66));

    for (const stratName of strategyNames) {
      const isPlanAndExecute = stratName.includes("plan");
      const stratDisplayName =
        isPlanAndExecute && noReplanner
          ? "plan-and-execute (no-replanner)"
          : stratName;

      console.log(`\n  ⚙ Executando estratégia: ${stratDisplayName}...`);

      const { store, repos } = await scenario.setupStore();
      const tools = createOpsTools(store);

      let strategy: ReasoningStrategy;
      if (isPlanAndExecute) {
        strategy = createPlanAndExecuteStrategy({
          tools,
          noReplanner,
        });
      } else {
        strategy = createReactStrategy({
          tools,
        });
      }

      try {
        const result = await strategy.run(scenario.prompt, {
          maxIterations,
          noReplanner,
          tools,
        });

        const verification = await scenario.verify({
          result,
          store,
          repos,
        });

        const statusLabel = verification.success ? "✓ ACERTO (SIM)" : "✗ ERRO (NÃO)";
        console.log(`    Resposta : ${result.answer.trim()}`);
        console.log(`    Status   : ${statusLabel} -> ${verification.details}`);
        console.log(`    Métricas : ${summarizeMetrics(result.metrics)}`);

        results.push({
          scenario: scenario.name,
          strategy: stratDisplayName,
          success: verification.success,
          llmCalls: result.metrics.llmCalls,
          latencyMs: result.metrics.latencyMs,
          details: verification.details,
        });
      } catch (error) {
        const boundary = toBoundaryMessage(error);
        const errorMsg =
          boundary ??
          (error instanceof DomainError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error));

        console.log(`    Status   : ✗ FALHA NA EXECUÇÃO -> ${errorMsg}`);

        results.push({
          scenario: scenario.name,
          strategy: stratDisplayName,
          success: false,
          llmCalls: 0,
          latencyMs: 0,
          details: `Erro: ${errorMsg}`,
        });
      }
    }
  }

  console.log("\n\n==================================================================");
  console.log("                     TABELA CONSOLIDADA                           ");
  console.log("==================================================================");
  console.log(renderAsciiTable(results));
  console.log("==================================================================\n");
}

import { fileURLToPath } from "node:url";

const isMainModule =
  Boolean(process.argv[1]) &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1]?.endsWith("/bench.ts") ||
    process.argv[1]?.endsWith("\\bench.ts") ||
    process.argv[1] === "src/bench.ts");

if (isMainModule) {
  runBenchmark().catch((err) => {
    console.error("Erro fatal no benchmark:", err);
    process.exit(1);
  });
}
