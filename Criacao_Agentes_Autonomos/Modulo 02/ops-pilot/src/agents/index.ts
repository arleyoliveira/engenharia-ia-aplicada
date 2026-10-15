import { planAndExecuteStrategy } from "./plan-and-execute.js";
import { reactStrategy } from "./react.js";
import { withReflection } from "./reflection.js";
import type { ReasoningStrategy } from "./types.js";

export interface StrategyRegistry {
  resolve(name: string, reflect: boolean): ReasoningStrategy | undefined;
  names(): readonly string[];
}

export function createStrategyRegistry(
  strategies: Readonly<Record<string, ReasoningStrategy>> = {
    react: reactStrategy,
    "plan-and-execute": planAndExecuteStrategy,
  },
): StrategyRegistry {
  return {
    resolve(name, reflect) {
      const strategy = strategies[name];
      if (!strategy) {
        return undefined;
      }
      return reflect ? withReflection(strategy) : strategy;
    },
    names() {
      return Object.keys(strategies);
    },
  };
}

export const strategyRegistry = createStrategyRegistry();
