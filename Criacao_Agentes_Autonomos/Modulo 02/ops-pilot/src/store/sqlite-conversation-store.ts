import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { InvalidStateError, NotFoundError } from "../errors.js";
import type {
  ConversationMessage,
  ConversationStore,
  ConversationSummary,
  MessageRole,
} from "./conversation-store.js";

type MessageRow = {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};

type SummaryRow = {
  conversationId: string;
  text: string;
  coveredThroughMessageId: number;
  updatedAt: string;
};

export class SqliteConversationStore implements ConversationStore {
  constructor(private readonly db: DatabaseSync) {}

  create(): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO conversations (id) VALUES (?)").run(id);
    return id;
  }

  append(
    conversationId: string,
    message: { role: MessageRole; content: string },
  ): void {
    this.assertConversationExists(conversationId);
    this.db
      .prepare(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
      )
      .run(conversationId, message.role, message.content);
  }

  lastMessages(conversationId: string, limit: number): ConversationMessage[] {
    if (limit < 1) {
      throw new InvalidStateError("limit de lastMessages deve ser >= 1.");
    }
    this.assertConversationExists(conversationId);

    const rows = this.db
      .prepare(
        `SELECT id, conversationId, role, content, createdAt FROM (
           SELECT
             id,
             conversation_id AS conversationId,
             role,
             content,
             created_at AS createdAt
           FROM messages
           WHERE conversation_id = ?
           ORDER BY id DESC
           LIMIT ?
         ) recent
         ORDER BY id ASC`,
      )
      .all(conversationId, limit) as MessageRow[];

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  }

  getSummary(conversationId: string): ConversationSummary | null {
    this.assertConversationExists(conversationId);
    const row = this.db
      .prepare(
        `SELECT
           conversation_id AS conversationId,
           summary AS text,
           covered_through_message_id AS coveredThroughMessageId,
           updated_at AS updatedAt
         FROM conversation_summaries
         WHERE conversation_id = ?`,
      )
      .get(conversationId) as SummaryRow | undefined;
    if (!row) {
      return null;
    }
    return {
      conversationId: row.conversationId,
      text: row.text,
      coveredThroughMessageId: row.coveredThroughMessageId,
      updatedAt: row.updatedAt,
    };
  }

  upsertSummary(
    conversationId: string,
    input: { text: string; coveredThroughMessageId: number },
  ): void {
    this.assertConversationExists(conversationId);
    const text = input.text.trim();
    if (text.length === 0) {
      throw new InvalidStateError("summary text não pode ser vazio.");
    }
    if (input.coveredThroughMessageId < 0) {
      throw new InvalidStateError(
        "coveredThroughMessageId deve ser >= 0.",
      );
    }
    this.db
      .prepare(
        `INSERT INTO conversation_summaries (
           conversation_id, summary, covered_through_message_id, updated_at
         ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(conversation_id) DO UPDATE SET
           summary = excluded.summary,
           covered_through_message_id = excluded.covered_through_message_id,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .run(conversationId, text, input.coveredThroughMessageId);
  }

  messagesBefore(
    conversationId: string,
    beforeIdExclusive: number,
    afterIdExclusive: number,
    limit: number,
  ): ConversationMessage[] {
    if (limit < 1) {
      throw new InvalidStateError("limit de messagesBefore deve ser >= 1.");
    }
    this.assertConversationExists(conversationId);

    const rows = this.db
      .prepare(
        `SELECT
           id,
           conversation_id AS conversationId,
           role,
           content,
           created_at AS createdAt
         FROM messages
         WHERE conversation_id = ?
           AND id > ?
           AND id < ?
         ORDER BY id ASC
         LIMIT ?`,
      )
      .all(
        conversationId,
        afterIdExclusive,
        beforeIdExclusive,
        limit,
      ) as MessageRow[];

    return rows.map((row) => ({
      id: row.id,
      conversationId: row.conversationId,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  }

  private assertConversationExists(conversationId: string): void {
    const row = this.db
      .prepare("SELECT 1 AS ok FROM conversations WHERE id = ?")
      .get(conversationId) as { ok: number } | undefined;
    if (!row) {
      throw new NotFoundError(`Conversa não encontrada: "${conversationId}"`);
    }
  }
}
