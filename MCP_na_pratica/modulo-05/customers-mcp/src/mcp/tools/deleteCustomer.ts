import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import { CustomerMutationSchema } from "../../domain/customer.ts";
import z from "zod/v3";

export function registerDeleteCustomerTool(
    server: McpServer,
    service: CustomerService
) {

    server.registerTool(
        "delete_customer",
        {
            description: "Delte an existing customer by id",
            inputSchema: {
                _id: z.string().describe('The id of the customer to retrieve')
            },
            outputSchema: CustomerMutationSchema.shape
        },
        async ({ _id }) => {
            try {
                const result = await service.deleteCustomer(_id);
                return {
                    content: [
                        {
                            type: 'text',
                            text: result.message ?? ""
                        }
                    ],
                    structuredContent: result
                }

            } catch (error) {
                return {
                    isError: true,
                    content: [{
                        type: 'text',
                        text: `Failed to delete customer.Error: ${error instanceof Error ? error.message : String(error)}`
                    }]
                }
            }
        }
    )
}