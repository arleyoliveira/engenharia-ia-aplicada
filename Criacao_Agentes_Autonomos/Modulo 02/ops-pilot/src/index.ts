import { z } from "zod";
import { createChatServer } from "./http/server.js";

const portSchema = z.coerce.number().int().min(1).max(65535).default(3000);
const port = portSchema.parse(process.env.PORT);

createChatServer().listen(port, () => {
	console.log(`OpsPilot HTTP server listening on port ${port}.`);
});