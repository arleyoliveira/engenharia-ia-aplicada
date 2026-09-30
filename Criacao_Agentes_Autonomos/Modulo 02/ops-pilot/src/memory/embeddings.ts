/**
 * Lazy singleton de embeddings locais (all-MiniLM-L6-v2 via Transformers.js).
 * Import dinâmico evita carregar onnxruntime no boot do processo.
 */
import { DomainError } from "../errors.js";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const { pipeline } = await import("@huggingface/transformers");
        return (await pipeline(
          "feature-extraction",
          MODEL_ID,
        )) as unknown as FeatureExtractionPipeline;
      } catch (cause: unknown) {
        extractorPromise = null;
        const detail =
          cause instanceof Error ? cause.message : String(cause);
        throw new DomainError(
          "EMBEDDING_LOAD_ERROR",
          `Falha ao carregar o modelo de embedding local: ${detail}`,
        );
      }
    })();
  }
  return extractorPromise;
}

/** Vetor L2-normalizado (pooling mean + normalize). */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await loadExtractor();
  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });
  const data = output.data;
  return data instanceof Float32Array
    ? new Float32Array(data)
    : Float32Array.from(data);
}

/** Reinicia o singleton (testes). */
export function resetEmbedderForTests(): void {
  extractorPromise = null;
}
