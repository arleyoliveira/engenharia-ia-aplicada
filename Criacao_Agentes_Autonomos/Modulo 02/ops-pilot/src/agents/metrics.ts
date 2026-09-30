/**
 * Contagem de chamadas de LLM e tokens de prompt via callback do LangChain.
 * `latencyMs` é medido pelo run() da estratégia.
 */
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { promptTokensFromLlmEnd } from "../context/tokens.js";

export interface LlmCallCounter {
  readonly calls: number;
  readonly promptTokens: number;
  handler: BaseCallbackHandler;
}

export function createLlmCallCounter(): LlmCallCounter {
  let calls = 0;
  let promptTokens = 0;
  const handler = BaseCallbackHandler.fromMethods({
    handleLLMStart() {
      calls += 1;
    },
    handleLLMEnd(output) {
      promptTokens += promptTokensFromLlmEnd(output);
    },
  });
  return {
    get calls() {
      return calls;
    },
    get promptTokens() {
      return promptTokens;
    },
    handler,
  };
}
