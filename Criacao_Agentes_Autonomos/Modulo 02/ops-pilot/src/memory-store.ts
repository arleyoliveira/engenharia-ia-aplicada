/**
 * MemoryStore semântico: remember / recall / forget por userId.
 * Embeddings em BLOB (Float32 LE); ranking por produto escalar.
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { InvalidStateError } from "./errors.js";

export const DEDUP_THRESHOLD = 0.92;
export const RECALL_MIN_SCORE = 0.3;
export const RECALL_TOP_K = 3;

export interface RecallHit {
  id: string;
  fact: string;
  score: number;
}

export type Embedder = (text: string) => Promise<Float32Array>;

export interface MemoryStore {
  remember(userId: string, fact: string): Promise<string | null>;
  recall(userId: string, query: string): Promise<RecallHit[]>;
  forget(userId: string, id: string): Promise<boolean>;
}

interface StoredMemory {
  id: string;
  userId: string;
  fact: string;
  embedding: Float32Array;
  createdAt: string;
}

interface MemoryRow {
  id: string;
  user_id: string;
  fact: string;
  embedding: Buffer | Uint8Array;
  created_at: string;
}

export function dotProduct(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

export function encodeEmbedding(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function decodeEmbedding(blob: Buffer | Uint8Array): Float32Array {
  const copy = Buffer.from(blob);
  return new Float32Array(
    copy.buffer,
    copy.byteOffset,
    copy.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
}

function requireNonEmpty(label: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new InvalidStateError(`${label} não pode ser vazio.`);
  }
  return trimmed;
}

/** Lazy default: evita carregar @huggingface/transformers no import do store. */
const defaultEmbedder: Embedder = async (text) => {
  const { embed } = await import("./memory/embeddings.js");
  return embed(text);
};

export class SqliteMemoryStore implements MemoryStore {
  private readonly embedder: Embedder;

  constructor(
    private readonly db: DatabaseSync,
    embedder: Embedder = defaultEmbedder,
  ) {
    this.embedder = embedder;
  }

  private allForUser(userId: string): StoredMemory[] {
    const stmt = this.db.prepare(
      `SELECT id, user_id, fact, embedding, created_at
       FROM memories
       WHERE user_id = ?`,
    );
    const rows = stmt.all(userId) as unknown as MemoryRow[];
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      fact: row.fact,
      embedding: decodeEmbedding(row.embedding),
      createdAt: row.created_at,
    }));
  }

  async remember(userId: string, fact: string): Promise<string | null> {
    const uid = requireNonEmpty("userId", userId);
    const text = requireNonEmpty("fact", fact);
    const vector = await this.embedder(text);

    for (const existing of this.allForUser(uid)) {
      if (dotProduct(vector, existing.embedding) >= DEDUP_THRESHOLD) {
        return null;
      }
    }

    const id = randomUUID();
    const insert = this.db.prepare(
      `INSERT INTO memories (id, user_id, fact, embedding)
       VALUES (?, ?, ?, ?)`,
    );
    insert.run(id, uid, text, encodeEmbedding(vector));
    return id;
  }

  /**
   * Referência de ranking: embed → score (dot) → sort → filter ≥ 0.3 → top-k.
   */
  async recall(
    userId: string,
    query: string,
    k = RECALL_TOP_K,
  ): Promise<RecallHit[]> {
    const uid = requireNonEmpty("userId", userId);
    const qText = requireNonEmpty("query", query);
    const q = await this.embedder(qText);

    return this.allForUser(uid)
      .map((mappedUser) => ({
        id: mappedUser.id,
        fact: mappedUser.fact,
        score: dotProduct(q, mappedUser.embedding),
        createdAt: mappedUser.createdAt,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.createdAt !== b.createdAt) {
          return a.createdAt < b.createdAt ? 1 : -1;
        }
        return a.id < b.id ? 1 : -1;
      })
      .filter((mappedUser) => mappedUser.score >= RECALL_MIN_SCORE)
      .slice(0, k)
      .map(({ id, fact, score }) => ({ id, fact, score }));
  }

  async forget(userId: string, id: string): Promise<boolean> {
    const uid = requireNonEmpty("userId", userId);
    const memoryId = requireNonEmpty("id", id);
    const result = this.db
      .prepare(`DELETE FROM memories WHERE id = ? AND user_id = ?`)
      .run(memoryId, uid);
    return Number(result.changes) > 0;
  }
}

/** Fake para testes de chat / runChat sem carregar o modelo HF. */
export class InMemoryMemoryStore implements MemoryStore {
  private readonly byUser = new Map<string, Map<string, string>>();

  /** Fatos fixos devolvidos por recall (independente da query). */
  private readonly recallOverride = new Map<string, string[]>();

  seedRecall(userId: string, facts: string[]): void {
    this.recallOverride.set(userId, [...facts]);
    const bucket = this.byUser.get(userId) ?? new Map();
    for (const fact of facts) {
      bucket.set(randomUUID(), fact);
    }
    this.byUser.set(userId, bucket);
  }

  async remember(userId: string, fact: string): Promise<string | null> {
    const uid = requireNonEmpty("userId", userId);
    const text = requireNonEmpty("fact", fact);
    const bucket = this.byUser.get(uid) ?? new Map();
    for (const existing of bucket.values()) {
      if (existing === text) {
        return null;
      }
    }
    const id = randomUUID();
    bucket.set(id, text);
    this.byUser.set(uid, bucket);
    return id;
  }

  async recall(userId: string, _query: string): Promise<RecallHit[]> {
    const uid = requireNonEmpty("userId", userId);
    const bucket = this.byUser.get(uid);
    const entries = bucket ? [...bucket.entries()] : [];
    return entries.slice(0, RECALL_TOP_K).map(([id, fact], index) => ({
      id,
      fact,
      score: 1 - index * 0.01,
    }));
  }

  async forget(userId: string, id: string): Promise<boolean> {
    const uid = requireNonEmpty("userId", userId);
    const memoryId = requireNonEmpty("id", id);
    const bucket = this.byUser.get(uid);
    if (!bucket?.has(memoryId)) {
      return false;
    }
    const fact = bucket.get(memoryId);
    bucket.delete(memoryId);
    const override = this.recallOverride.get(uid);
    if (override && fact) {
      this.recallOverride.set(
        uid,
        override.filter((entry) => entry !== fact),
      );
    }
    return true;
  }
}
