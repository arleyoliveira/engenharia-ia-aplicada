import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCliApp } from "../cli/app.js";
import { createHttpApp } from "../http/app.js";

async function createTempBaseDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "notas-api-integration-persist-"));
}

async function startServer(dataFilePath: string) {
  const server = createHttpApp({ dataFilePath });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve server port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}

test("deve criar via HTTP e listar via CLI no mesmo arquivo persistido", async () => {
  const baseDir = await createTempBaseDir();
  const dataFilePath = join(baseDir, ".data", "tasks.json");

  try {
    const app = await startServer(dataFilePath);
    try {
      await fetch(`${app.baseUrl}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "via http" })
      });

      const cliList = runCliApp(["tasks", "list"], { dataFilePath });

      assert.equal(cliList.exitCode, 0);
      assert.deepEqual(cliList.stdout, ["1. [open] via http"]);
    } finally {
      await app.close();
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("deve criar via CLI e listar via HTTP no mesmo arquivo persistido", async () => {
  const baseDir = await createTempBaseDir();
  const dataFilePath = join(baseDir, ".data", "tasks.json");

  try {
    runCliApp(["tasks", "create", "--title", "via cli"], { dataFilePath });

    const app = await startServer(dataFilePath);
    try {
      const response = await fetch(`${app.baseUrl}/tasks`);
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.deepEqual(body, [{ id: 1, title: "via cli", status: "open" }]);
    } finally {
      await app.close();
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("deve concluir e remover cruzando canais no mesmo arquivo persistido", async () => {
  const baseDir = await createTempBaseDir();
  const dataFilePath = join(baseDir, ".data", "tasks.json");

  try {
    const app = await startServer(dataFilePath);
    try {
      await fetch(`${app.baseUrl}/tasks`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "primeira" })
      });

      const cliComplete = runCliApp(["tasks", "complete", "--id", "1"], { dataFilePath });
      assert.equal(cliComplete.exitCode, 0);

      const doneList = await fetch(`${app.baseUrl}/tasks?filter=done`);
      const doneBody = await doneList.json();
      assert.deepEqual(doneBody, [{ id: 1, title: "primeira", status: "done" }]);

      await fetch(`${app.baseUrl}/tasks/1`, { method: "DELETE" });
      const cliList = runCliApp(["tasks", "list"], { dataFilePath });

      assert.deepEqual(cliList.stdout, ["Nenhuma tarefa encontrada."]);
    } finally {
      await app.close();
    }
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});
