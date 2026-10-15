import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import z from "zod/v3";
import { type CustomerQuery, CustomerQuerySchema, CustomerSchema } from "../../domain/customer.ts";

export function registerGetCustomerTool(
    server: McpServer,
    service: CustomerService
) {

    server.registerTool(
        "get_customer",
        {
            description: "Get a specific customer by id, name, or phone number",
            inputSchema: CustomerQuerySchema,
            outputSchema: {
                customer: CustomerSchema.nullable().describe('Customer details if found, otherwise null')
            }
        },
        async (customerQuery: CustomerQuery) => {
            try {
                const customer = await service.findCustomer(customerQuery);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(customer, null, 2)
                        }
                    ],
                    structuredContent: { customer }
                }
            } catch (error) {
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: `Failed to get customer.Error: ${error instanceof Error ? error.message : String(error)}`
                    }]
                }
            }
        }
    )
}