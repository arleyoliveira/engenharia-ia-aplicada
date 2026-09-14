/**
 * Contagem de chamadas de LLM via callback do LangChain (research R5).
 * `latencyMs` é medido pelo run() da estratégia.
 */
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

export interface LlmCallCounter {
  readonly calls: number;
  handler: BaseCallbackHandler;
}

export function createLlmCallCounter(): LlmCallCounter {
  let calls = 0;
  const handler = BaseCallbackHandler.fromMethods({
    handleLLMStart() {
      calls += 1;
    },
  });
  return {
    get calls() {
      return calls;
    },
    handler,
  };
}
