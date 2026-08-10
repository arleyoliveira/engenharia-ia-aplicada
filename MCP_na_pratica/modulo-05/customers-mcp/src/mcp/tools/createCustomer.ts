import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import z from "zod/v3";
import { CustomerMutationSchema, CustomerSchema } from "../../domain/customer.ts";

export function registerCreateCustomerTool(
    server: McpServer,
    service: CustomerService
) {

    server.registerTool(
        "create_customer",
        {
            description: "Create a new customer",
            inputSchema: CustomerSchema,
            outputSchema: CustomerMutationSchema
        },
        async ({name, phone}) => {
            try {
                const customerCreated = await service.createCustomer({ name, phone });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(customerCreated, null, 2)
                        }
                    ],
                    structuredContent: customerCreated
                }

            } catch (error) {
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: `Failed to create customer.Error: ${error instanceof Error ? error.message : String(error)}`
                    }]
                }
            }
        }
    )
}