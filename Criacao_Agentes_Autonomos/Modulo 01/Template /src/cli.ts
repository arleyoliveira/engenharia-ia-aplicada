import { join } from "node:path";

import { runCliApp } from "./cli/app.js";

const dataFilePath = join(process.cwd(), ".data", "tasks.json");
const result = runCliApp(process.argv.slice(2), { dataFilePath });

if (result.stdout.length > 0) {
	for (const line of result.stdout) {
		console.log(line);
	}
}

if (result.stderr.length > 0) {
	for (const line of result.stderr) {
		console.error(line);
	}
}

process.exitCode = result.exitCode;
