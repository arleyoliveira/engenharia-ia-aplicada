/**
 * Arena: executa 1+ estratégias sobre o mesmo input e imprime, para cada
 * uma, nome, resposta, trace formatado e métricas (contracts/cli.md).
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { DomainError, toBoundaryMessage } from "./errors.js";
import { formatTrace, summarizeMetrics } from "./agents/trace.js";
import { reactStrategy } from "./agents/react.js";
import { planAndExecuteStrategy } from "./agents/plan-and-execute.js";
import { withReflection } from "./agents/reflection.js";
import type { ReasoningStrategy } from "./agents/types.js";

const STRATEGIES: Record<string, ReasoningStrategy> = {
  react: reactStrategy,
  "plan-and-execute": planAndExecuteStrategy,
  "reflect:react": withReflection(reactStrategy),
  "reflec:react": withReflection(reactStrategy, { name: "reflec:react" }),
  "reflect:plan-and-execute": withReflection(planAndExecuteStrategy),
  "reflec:plan-and-execute": withReflection(planAndExecuteStrategy, {
    name: "reflec:plan-and-execute",
  }),
};

const cliSchema = z.object({
  strategies: z
    .string()
    .min(1)
    .default("react")
    .transform((value) => value.split(",").map((name) => name.trim())),
  "max-iterations": z.coerce.number().int().positive().default(8),
  input: z.string().min(1, "input não pode ser vazio"),
});

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      strategies: { type: "string" },
      "max-iterations": { type: "string" },
    },
    allowPositionals: true,
  });

  const parsed = cliSchema.safeParse({
    strategies: values.strategies ?? "react",
    "max-iterations": values["max-iterations"] ?? 8,
    input: positionals.join(" ").trim(),
  });
  if (!parsed.success) {
    fail(`Argumentos inválidos: ${parsed.error.issues[0]?.message}`);
  }

  const { strategies: names, input } = parsed.data;
  const maxIterations = parsed.data["max-iterations"];

  const selected: ReasoningStrategy[] = [];
  for (const name of names) {
    const strategy = STRATEGIES[name];
    if (!strategy) {
      fail(
        `Estratégia desconhecida: "${name}". Disponíveis: ${Object.keys(STRATEGIES).join(", ")}`,
      );
    }
    selected.push(strategy);
  }

  for (const strategy of selected) {
    console.log(`=== ${strategy.name} ===`);
    try {
      const result = await strategy.run(input, { maxIterations });
      console.log(`Answer: ${result.answer}`);
      console.log("Trace:");
      for (const line of formatTrace(result.trace).split("\n")) {
        console.log(`  ${line}`);
      }
      console.log(`Metrics: ${summarizeMetrics(result.metrics)}`);
      console.log();
    } catch (error) {
      const boundary = toBoundaryMessage(error);
      if (boundary) {
        fail(boundary);
      }
      if (error instanceof DomainError) {
        fail(error.message);
      }
      throw error;
    }
  }
}

main().catch((error: unknown) => {
  const boundary = toBoundaryMessage(error);
  fail(boundary ?? `Erro inesperado: ${error instanceof Error ? error.message : String(error)}`);
});
