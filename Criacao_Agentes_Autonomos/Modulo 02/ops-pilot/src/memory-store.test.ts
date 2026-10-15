import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SqliteOpsStore } from "./store/sqlite-ops-store.js";
import {
  DEDUP_THRESHOLD,
  RECALL_MIN_SCORE,
  SqliteMemoryStore,
  type Embedder,
} from "./memory-store.js";

function unit(index: number, dim = 8): Float32Array {
  const v = new Float32Array(dim);
  v[index % dim] = 1;
  return v;
}

function nearlyEqual(a: Float32Array, noise = 0.01): Float32Array {
  const v = new Float32Array(a);
  if (v.length > 1) {
    v[1] = (v[1] ?? 0) + noise;
  }
  // re-normalize lightly for stable high dot with original
  let norm = 0;
  for (let i = 0; i < v.length; i += 1) {
    norm += (v[i] ?? 0) ** 2;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i += 1) {
    v[i] = (v[i] ?? 0) / norm;
  }
  return v;
}

describe("SqliteMemoryStore", () => {
  it("isolamento por userId com Embedder fake", async () => {
    const ops = new SqliteOpsStore(":memory:");
    const vectors = new Map<string, Float32Array>([
      ["fato-a", unit(0)],
      ["fato-b", unit(1)],
      ["consulta-a", unit(0)],
    ]);
    const embedder: Embedder = async (text) => {
      const v = vectors.get(text);
      assert.ok(v, `vetor ausente para: ${text}`);
      return v;
    };
    const store = new SqliteMemoryStore(ops.db, embedder);

    await store.remember("alice", "fato-a");
    await store.remember("bob", "fato-b");

    const hits = await store.recall("alice", "consulta-a");
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.fact, "fato-a");
    assert.ok((hits[0]?.score ?? 0) >= RECALL_MIN_SCORE);
  });

  it("dedup ≥ 0.92 retorna null e não duplica", async () => {
    const ops = new SqliteOpsStore(":memory:");
    const base = unit(0);
    const close = nearlyEqual(base, 0.05);
    assert.ok(
      (() => {
        let sum = 0;
        for (let i = 0; i < base.length; i += 1) {
          sum += (base[i] ?? 0) * (close[i] ?? 0);
        }
        return sum >= DEDUP_THRESHOLD;
      })(),
    );

    const embedder: Embedder = async (text) => {
      if (text === "original") {
        return base;
      }
      return close;
    };
    const store = new SqliteMemoryStore(ops.db, embedder);

    const first = await store.remember("u1", "original");
    const second = await store.remember("u1", "quase-igual");
    assert.ok(first);
    assert.equal(second, null);

    const count = ops.db
      .prepare(`SELECT COUNT(*) AS n FROM memories WHERE user_id = ?`)
      .get("u1") as { n: number };
    assert.equal(Number(count.n), 1);
  });

  it("forget remove no escopo do user; noop para outro user", async () => {
    const ops = new SqliteOpsStore(":memory:");
    const embedder: Embedder = async () => unit(0);
    const store = new SqliteMemoryStore(ops.db, embedder);

    const id = await store.remember("alice", "segredo");
    assert.ok(id);

    assert.equal(await store.forget("bob", id), false);
    assert.equal((await store.recall("alice", "segredo")).length, 1);

    assert.equal(await store.forget("alice", id), true);
    assert.equal((await store.recall("alice", "segredo")).length, 0);
    assert.equal(await store.forget("alice", id), false);
  });

  it(
    "recall semântico: acha fato sem palavra em comum (modelo real)",
    { timeout: 180_000 },
    async () => {
      const { embed } = await import("./memory/embeddings.js");
      const ops = new SqliteOpsStore(":memory:");
      const store = new SqliteMemoryStore(ops.db, embed);

      await store.remember("ops-alice", "prefiro alertas em português");
      const hits = await store.recall(
        "ops-alice",
        "qual idioma das notificações?",
      );

      assert.ok(hits.length >= 1);
      assert.ok(hits.some((h) => h.fact.includes("português")));
      assert.ok((hits[0]?.score ?? 0) >= RECALL_MIN_SCORE);
      assert.ok(hits.length <= 3);
    },
  );
});
