import { z } from "zod";

export const TASK_TITLE_MIN_LENGTH = 1;
export const TASK_TITLE_MAX_LENGTH = 255;

export const taskStatusSchema = z.enum(["open", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskFilterSchema = z.enum(["all", "open", "done"]);
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const taskIdSchema = z.number().int().positive();

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(TASK_TITLE_MIN_LENGTH).max(TASK_TITLE_MAX_LENGTH)
});
export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export const listTasksInputSchema = z.object({
  filter: taskFilterSchema.default("all")
});
export type ListTasksInput = z.infer<typeof listTasksInputSchema>;

export const taskSchema = z.object({
  id: taskIdSchema,
  title: createTaskInputSchema.shape.title,
  status: taskStatusSchema
});
export type Task = z.infer<typeof taskSchema>;

export const taskListSchema = z.array(taskSchema);
