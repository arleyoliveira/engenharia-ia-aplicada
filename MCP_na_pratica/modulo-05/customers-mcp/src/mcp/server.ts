import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CustomerHttpClient } from "../infrastructure/customerHttpClient.ts";
import { CustomerService } from "../application/customerService.ts";
import { registerListCustomerTool } from "./tools/listCustomers.ts";
import { registerApiInfoResource } from "./resources/apiinfo.ts";
import { registerCreateCustomerTool } from "./tools/createCustomer.ts";
import { registerGetCustomerTool } from "./tools/getCustomer.ts";
import { registerFindCustomerPrompt } from "./prompts/findCustomer.ts";
import { registerUpdateCustomerTool } from "./tools/updateCustomer.ts";
import { registerDeleteCustomerTool } from "./tools/deleteCustomer.ts";

const BASE_URL = "http://localhost:9999/v1";

const service = new CustomerService(BASE_URL);

export const server = new McpServer({
    name: "@arleyoliveira/ew-customers-mcp",
    version: "0.0.1",
});

//tools
registerListCustomerTool(server, service);
registerCreateCustomerTool(server, service);
registerGetCustomerTool(server, service);
registerUpdateCustomerTool(server, service);
registerDeleteCustomerTool(server, service);

//resources
registerApiInfoResource(server, BASE_URL);

//prompts
registerFindCustomerPrompt(server);