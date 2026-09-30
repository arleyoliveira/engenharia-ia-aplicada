import { z } from "zod";
import { createChatServer } from "./http/server.js";
import {
  getDefaultConversationStore,
  getDefaultMemoryStore,
  getDefaultRequestTraceStore,
} from "./services/default-store.js";
import { createLlmHistorySummarizer } from "./services/history-summarizer.js";

const portSchema = z.coerce.number().int().min(1).max(65535).default(3000);
const port = portSchema.parse(process.env.PORT);

const conversationStore = await getDefaultConversationStore();
const memoryStore = await getDefaultMemoryStore();
const requestTraceStore = await getDefaultRequestTraceStore();
const summarizer = createLlmHistorySummarizer();

createChatServer({
  conversationStore,
  memoryStore,
  summarizer,
  requestTraceStore,
}).listen(
  port,
  () => {
    console.log(`OpsPilot HTTP server listening on port ${port}.`);
  },
);
