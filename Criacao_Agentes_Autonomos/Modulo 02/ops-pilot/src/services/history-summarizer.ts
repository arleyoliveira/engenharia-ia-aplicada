/**
 * Sumarizador de histórico: mescla lote podado + resumo anterior (~150 tokens).
 */
import { createModel } from "../agents/model.js";
import { estimateTokens } from "../context/tokens.js";
import { SUMMARY_TARGET_TOKENS } from "./compose-chat-prompt.js";

export const SUMMARIZER_PROMPT = `Comprima o trecho de conversa a seguir em no máximo 150 tokens, preservando obrigatoriamente: decisões tomadas, fatos estabelecidos (nomes, datas, prazos, preferências), incidentes abertos/resolvidos e pendêncais abertas. Descarte cumprimetos e conversa social. Se houver um resumo anterior, incorpore-o. Responda só o resumo, em tópicos telegráficos.`;

export type SummarizeInput = {
  previous?: string;
  batch: Array<{ role: "user" | "assistant"; content: string }>;
};

export interface HistorySummarizer {
  summarize(input: SummarizeInput): Promise<string>;
}

function formatBatch(
  batch: SummarizeInput["batch"],
): string {
  return batch.map((entry) => `${entry.role}: ${entry.content}`).join("\n");
}

function padToTargetTokens(core: string, target = SUMMARY_TARGET_TOKENS): string {
  const targetChars = target * 4;
  if (core.length >= targetChars) {
    return core.slice(0, targetChars);
  }
  const filler = " ·keep·";
  let out = core;
  while (out.length < targetChars) {
    out += filler;
  }
  return out.slice(0, targetChars);
}

/** Fake determinístico para testes (sem rede). */
export function createFakeHistorySummarizer(): HistorySummarizer & {
  calls: SummarizeInput[];
} {
  const calls: SummarizeInput[] = [];
  return {
    calls,
    async summarize(input) {
      calls.push(input);
      const axes: string[] = [];
      const material = [
        input.previous ?? "",
        ...input.batch.map((entry) => entry.content),
      ].join("\n");
      if (/decis[aã]o/i.test(material)) {
        axes.push("decisão");
      }
      if (/fato/i.test(material)) {
        axes.push("fato");
      }
      if (/pend[eê]ncia/i.test(material)) {
        axes.push("pendência");
      }
      const batchBits = input.batch
        .map((entry) => `${entry.role}:${entry.content}`)
        .join("|");
      const prevBit = input.previous?.trim()
        ? `PREV:${input.previous.trim().slice(0, 80)}`
        : "PREV:none";
      const core = [
        "RESUMO",
        prevBit,
        `BATCH:${batchBits}`,
        axes.length > 0 ? `EIXOS:${axes.join(",")}` : "EIXOS:none",
      ].join(" ");
      const text = padToTargetTokens(core);
      // Garante faixa ~120..180 para asserts
      const tokens = estimateTokens(text);
      if (tokens < 120 || tokens > 180) {
        return padToTargetTokens(core, 150);
      }
      return text;
    },
  };
}

/** Produção: uma chamada de modelo com SUMMARIZER_PROMPT. */
export function createLlmHistorySummarizer(): HistorySummarizer {
  return {
    async summarize(input) {
      const model = createModel();
      const previous = input.previous?.trim() ?? "";
      const userParts = [
        previous.length > 0
          ? `Resumo anterior:\n${previous}`
          : "Resumo anterior: (nenhum)",
        "",
        "Trecho novo:",
        formatBatch(input.batch),
      ];
      const result = await model.invoke([
        { role: "system", content: SUMMARIZER_PROMPT },
        { role: "user", content: userParts.join("\n") },
      ]);
      const content = result.content;
      const text =
        typeof content === "string"
          ? content.trim()
          : Array.isArray(content)
            ? content
                .map((part) =>
                  typeof part === "string"
                    ? part
                    : "text" in part
                      ? String(part.text)
                      : "",
                )
                .join("")
                .trim()
            : String(content).trim();
      if (text.length === 0) {
        throw new Error("Sumarizador devolveu texto vazio.");
      }
      return text;
    },
  };
}
