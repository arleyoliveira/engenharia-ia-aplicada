import { join } from "node:path";

import { createHttpApp } from "./http/app.js";

const port = Number(process.env.PORT ?? 3000);
const dataFilePath = join(process.cwd(), ".data", "tasks.json");

const server = createHttpApp({ dataFilePath });

server.listen(port, () => {
	// eslint-disable-next-line no-console
	console.log(`notas-api listening on http://localhost:${port}`);
});
