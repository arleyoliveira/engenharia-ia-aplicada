import { randomUUID } from "node:crypto";
import { InvalidStateError, NotFoundError } from "../errors.js";
import type {
  ConversationMessage,
  ConversationStore,
  ConversationSummary,
  MessageRole,
} from "./conversation-store.js";

type MemoryConversation = {
  id: string;
  createdAt: string;
  messages: ConversationMessage[];
  summary: ConversationSummary | null;
};

/** Fake in-memory para testes de HTTP / runChat (sem SQLite). */
export class MemoryConversationStore implements ConversationStore {
  private readonly conversations = new Map<string, MemoryConversation>();
  private nextMessageId = 1;

  create(): string {
    const id = randomUUID();
    this.conversations.set(id, {
      id,
      createdAt: new Date().toISOString(),
      messages: [],
      summary: null,
    });
    return id;
  }

  append(
    conversationId: string,
    message: { role: MessageRole; content: string },
  ): void {
    const conversation = this.require(conversationId);
    conversation.messages.push({
      id: this.nextMessageId++,
      conversationId,
      role: message.role,
      content: message.content,
      createdAt: new Date().toISOString(),
    });
  }

  lastMessages(conversationId: string, limit: number): ConversationMessage[] {
    if (limit < 1) {
      throw new InvalidStateError("limit de lastMessages deve ser >= 1.");
    }
    const conversation = this.require(conversationId);
    return conversation.messages.slice(-limit);
  }

  getSummary(conversationId: string): ConversationSummary | null {
    return this.require(conversationId).summary;
  }

  upsertSummary(
    conversationId: string,
    input: { text: string; coveredThroughMessageId: number },
  ): void {
    const conversation = this.require(conversationId);
    const text = input.text.trim();
    if (text.length === 0) {
      throw new InvalidStateError("summary text não pode ser vazio.");
    }
    if (input.coveredThroughMessageId < 0) {
      throw new InvalidStateError(
        "coveredThroughMessageId deve ser >= 0.",
      );
    }
    conversation.summary = {
      conversationId,
      text,
      coveredThroughMessageId: input.coveredThroughMessageId,
      updatedAt: new Date().toISOString(),
    };
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
    const conversation = this.require(conversationId);
    return conversation.messages
      .filter(
        (message) =>
          message.id > afterIdExclusive && message.id < beforeIdExclusive,
      )
      .slice(0, limit);
  }

  private require(conversationId: string): MemoryConversation {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new NotFoundError(`Conversa não encontrada: "${conversationId}"`);
    }
    return conversation;
  }
}
