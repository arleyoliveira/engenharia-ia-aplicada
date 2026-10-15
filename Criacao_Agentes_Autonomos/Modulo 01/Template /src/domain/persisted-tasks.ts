import { z } from "zod";

import { taskListSchema } from "./task.js";

export const persistedTasksSchema = z.object({
  nextId: z.number().int().positive(),
  tasks: taskListSchema
});

export type PersistedTasks = z.infer<typeof persistedTasksSchema>;

export const emptyPersistedTasks: PersistedTasks = {
  nextId: 1,
  tasks: []
};
