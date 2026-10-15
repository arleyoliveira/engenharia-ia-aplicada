import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createHttpApp } from "./app.js";

async function createTempBaseDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "notas-api-http-app-"));
}

async function startServer(dataFilePath: string, logs: string[] = []) {
  const server = createHttpApp({
    dataFilePath,
    onRecoveryLog: (message) => {
      logs.push(message);
    }
  });

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

test("createHttpApp deve manter estado entre reinicios do servidor", async () => {
  const baseDir = await createTempBaseDir();
  const dataFilePath = join(baseDir, ".data", "tasks.json");

  try {
    const first = await startServer(dataFilePath);

    await fetch(`${first.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "persistir http" })
    });
    await first.close();

    const second = await startServer(dataFilePath);
    const response = await fetch(`${second.baseUrl}/tasks`);
    const body = await response.json();
    await second.close();

    assert.equal(response.status, 200);
    assert.deepEqual(body, [{ id: 1, title: "persistir http", status: "open" }]);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("createHttpApp deve registrar recuperacao de corrupcao apenas em log", async () => {
  const baseDir = await createTempBaseDir();
  const dataDir = join(baseDir, ".data");
  const dataFilePath = join(dataDir, "tasks.json");
  const logs: string[] = [];

  try {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFilePath, "{broken", "utf-8");

    const app = await startServer(dataFilePath, logs);
    const response = await fetch(`${app.baseUrl}/tasks`);
    const body = await response.json();
    await app.close();

    assert.equal(response.status, 200);
    assert.deepEqual(body, []);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].startsWith("Arquivo de tarefas corrompido detectado."), true);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});
