/**
 * Tool forget_preference: remove preferência memorizada no escopo do userId.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { MemoryStore } from "../memory-store.js";
import { failurePayload } from "./ops-tool-defs.js";

export const forgetPreferenceSchema = z.object({
  preference: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Descrição em linguagem natural da preferência a esquecer (ex.: 'idioma das notificações').",
    ),
});

export const forgetPreferenceDescription =
  "Remove uma preferência previamente memorizada do usuário atual. Use quando o plantonista pedir para esquecer ou atualizar uma preferência (idioma, canal, severidade, etc.). Não use para apagar alertas ou incidentes. Remove no máximo uma memória (melhor match semântico) no escopo do userId do turn. Retorna JSON com forgotten e detalhes.";

export function createForgetPreferenceTool(deps: {
  memory: MemoryStore;
  userId: string;
}) {
  return tool(
    async (args) => {
      try {
        const preference = forgetPreferenceSchema.parse(args).preference;
        const hits = await deps.memory.recall(deps.userId, preference);
        const top = hits[0];
        if (!top) {
          return JSON.stringify({
            forgotten: false,
            reason: "not_found",
          });
        }
        const ok = await deps.memory.forget(deps.userId, top.id);
        if (!ok) {
          return JSON.stringify({
            forgotten: false,
            reason: "not_found",
          });
        }
        return JSON.stringify({
          forgotten: true,
          id: top.id,
          fact: top.fact,
        });
      } catch (error) {
        return failurePayload(error);
      }
    },
    {
      name: "forget_preference",
      description: forgetPreferenceDescription,
      schema: forgetPreferenceSchema,
    },
  );
}
