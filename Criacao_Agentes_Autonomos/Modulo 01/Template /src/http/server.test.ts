import assert from "node:assert/strict";
import test from "node:test";

import { TaskService } from "../service/task-service.js";
import { InMemoryTaskStore } from "../store/in-memory-task-store.js";
import { createTaskHttpServer } from "./server.js";

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

test("POST /tasks deve criar tarefa", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "  comprar cafe  " })
    });

    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.id, 1);
    assert.equal(body.title, "comprar cafe");
    assert.equal(body.status, "open");
  } finally {
    await app.close();
  }
});

test("POST /tasks deve retornar 400 para body invalido", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "   " })
    });

    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "VALIDATION_ERROR");
  } finally {
    await app.close();
  }
});

test("GET /tasks deve listar com filtro padrao all", async () => {
  const app = await startServer();

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

    const response = await fetch(`${app.baseUrl}/tasks`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.length, 2);
    assert.deepEqual(
      body.map((task: { id: number }) => task.id),
      [1, 2]
    );
  } finally {
    await app.close();
  }
});

test("GET /tasks deve retornar 400 para filtro invalido", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks?filter=invalid`);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "VALIDATION_ERROR");
  } finally {
    await app.close();
  }
});

test("PATCH /tasks/:id/complete deve concluir tarefa", async () => {
  const app = await startServer();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "concluir" })
    });

    const response = await fetch(`${app.baseUrl}/tasks/1/complete`, {
      method: "PATCH"
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.id, 1);
    assert.equal(body.status, "done");
  } finally {
    await app.close();
  }
});

test("PATCH /tasks/:id/complete deve retornar 404 para tarefa inexistente", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks/999/complete`, {
      method: "PATCH"
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "TASK_NOT_FOUND");
  } finally {
    await app.close();
  }
});

test("DELETE /tasks/:id deve retornar 204 sem corpo", async () => {
  const app = await startServer();

  try {
    await fetch(`${app.baseUrl}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "remover" })
    });

    const response = await fetch(`${app.baseUrl}/tasks/1`, {
      method: "DELETE"
    });
    const text = await response.text();

    assert.equal(response.status, 204);
    assert.equal(text, "");
  } finally {
    await app.close();
  }
});

test("DELETE /tasks/:id deve retornar 404 para tarefa inexistente", async () => {
  const app = await startServer();

  try {
    const response = await fetch(`${app.baseUrl}/tasks/999`, {
      method: "DELETE"
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "TASK_NOT_FOUND");
  } finally {
    await app.close();
  }
});
