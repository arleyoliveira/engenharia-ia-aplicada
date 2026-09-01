import assert from "node:assert/strict";
import test from "node:test";

import { runCliCommand } from "../cli/runner.js";
import { createTaskHttpServer } from "../http/server.js";
import { TaskService } from "../service/task-service.js";
import { InMemoryTaskStore } from "../store/in-memory-task-store.js";

async function startServer() {
  const service = new TaskService(new InMemoryTaskStore());
  const server = createTaskHttpServer(service);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve server port");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
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

function createCliService() {
  return new TaskService(new InMemoryTaskStore());
}

function parseTaskLine(line: string): { id: number; status: "open" | "done"; title: string } {
  const match = line.match(/^(\d+)\. \[(open|done)\] (.+)$/);
  if (!match) {
    throw new Error(`Invalid task line: ${line}`);
  }

  const [, id, status, title] = match;
  return {
    id: Number(id),
    status: status as "open" | "done",
    title
  };
}

test("HTTP e CLI devem criar tarefas com mesmo estado final", async () => {
  const app = await startServer();
  const cliService = createCliService();

  try {
    const httpResponse = await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "  alinhar roadmap  " })
    });
    const httpTask = await httpResponse.json();

    const cliResult = runCliCommand(["tasks", "create", "--title", "  alinhar roadmap  "], cliService);
    const cliTask = parseTaskLine(cliResult.stdout[0].replace("Tarefa criada: ", ""));

    assert.equal(httpResponse.status, 201);
    assert.equal(cliResult.exitCode, 0);
    assert.deepEqual(httpTask, cliTask);
  } finally {
    await app.close();
  }
});

test("HTTP e CLI devem listar tarefas com a mesma ordem", async () => {
  const app = await startServer();
  const cliService = createCliService();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "primeira" })
    });
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "segunda" })
    });
    runCliCommand(["tasks", "create", "--title", "primeira"], cliService);
    runCliCommand(["tasks", "create", "--title", "segunda"], cliService);

    const httpResponse = await fetch(`${app.baseUrl}/tasks`);
    const httpList = await httpResponse.json();

    const cliResult = runCliCommand(["tasks", "list"], cliService);
    const cliList = cliResult.stdout.map(parseTaskLine);

    assert.equal(httpResponse.status, 200);
    assert.equal(cliResult.exitCode, 0);
    assert.deepEqual(httpList, cliList);
  } finally {
    await app.close();
  }
});

test("HTTP e CLI devem concluir tarefas mantendo status done", async () => {
  const app = await startServer();
  const cliService = createCliService();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "finalizar doc" })
    });

    const httpResponse = await fetch(`${app.baseUrl}/tasks/1/complete`, {
      method: "PATCH"
    });
    const httpTask = await httpResponse.json();

    runCliCommand(["tasks", "create", "--title", "finalizar doc"], cliService);
    const cliResult = runCliCommand(["tasks", "complete", "--id", "1"], cliService);
    const cliTask = parseTaskLine(cliResult.stdout[0].replace("Tarefa concluída: ", ""));

    assert.equal(httpResponse.status, 200);
    assert.equal(cliResult.exitCode, 0);
    assert.deepEqual(httpTask, cliTask);
  } finally {
    await app.close();
  }
});

test("HTTP e CLI devem remover tarefas e refletir lista vazia", async () => {
  const app = await startServer();
  const cliService = createCliService();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "descartar" })
    });

    const httpRemove = await fetch(`${app.baseUrl}/tasks/1`, {
      method: "DELETE"
    });
    runCliCommand(["tasks", "create", "--title", "descartar"], cliService);
    const cliRemove = runCliCommand(["tasks", "remove", "--id", "1"], cliService);

    const httpListResponse = await fetch(`${app.baseUrl}/tasks`);
    const httpList = await httpListResponse.json();
    const cliList = runCliCommand(["tasks", "list"], cliService);

    assert.equal(httpRemove.status, 204);
    assert.equal(cliRemove.exitCode, 0);
    assert.equal(httpListResponse.status, 200);
    assert.deepEqual(httpList, []);
    assert.deepEqual(cliList.stdout, ["Nenhuma tarefa encontrada."]);
  } finally {
    await app.close();
  }
});
