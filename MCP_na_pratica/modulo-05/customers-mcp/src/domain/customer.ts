import { z } from "zod/v3";

export const CustomerSchema = z.object({
    _id: z.string().optional(),
    name: z.string(),
    phone: z.string()
});

export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerQuerySchema = z.object({
    _id: z.string().optional().describe('The id of the customer to retrieve'),
    name: z.string().optional().describe('The name of the customer to retrieve'),
    phone: z.string().optional().describe('The phone number of the customer to retrieve')
});

export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;

export const CustomerUpdateSchema = CustomerSchema.extend({
    _id: z.string().describe('The id of the customer to retrieve'),
})

export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>

export const CustomerMutationSchema = z.object({
    id: z.string().optional().describe('MongoDB ObjectId of the created customer'),
    message: z.string().optional().describe('Confirmation message'),
    isError: z.boolean().optional().describe('Indicates if an error occurred')
});

export type CustomerMutation = z.infer<typeof CustomerMutationSchema>