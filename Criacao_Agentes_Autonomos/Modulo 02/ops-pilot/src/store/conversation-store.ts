/** Contrato de persistência de conversas (create / append / lastMessages / summary). */
export type MessageRole = "user" | "assistant";

export interface ConversationMessage {
  id: number;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  conversationId: string;
  text: string;
  coveredThroughMessageId: number;
  updatedAt: string;
}

export interface ConversationStore {
  create(): string;
  append(
    conversationId: string,
    message: { role: MessageRole; content: string },
  ): void;
  lastMessages(conversationId: string, limit: number): ConversationMessage[];
  getSummary(conversationId: string): ConversationSummary | null;
  upsertSummary(
    conversationId: string,
    input: { text: string; coveredThroughMessageId: number },
  ): void;
  messagesBefore(
    conversationId: string,
    beforeIdExclusive: number,
    afterIdExclusive: number,
    limit: number,
  ): ConversationMessage[];
}
