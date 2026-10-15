import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerService } from "../../application/customerService.ts";
import { CustomerMutationSchema, type CustomerUpdate, CustomerUpdateSchema } from "../../domain/customer.ts";

export function registerUpdateCustomerTool(
    server: McpServer,
    service: CustomerService
) {

    server.registerTool(
        "update_customer",
        {
            description: "Update an existing customer's name and/or phone number by their _id",
            inputSchema: CustomerUpdateSchema.shape,
            outputSchema: CustomerMutationSchema.shape
        },
        async (customer: CustomerUpdate) => {
            try {
                const result = await service.updateCustomer(customer);
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
                        text: `Failed to upadte customer.Error: ${error instanceof Error ? error.message : String(error)}`
                    }]
                }
            }
        }
    )
}