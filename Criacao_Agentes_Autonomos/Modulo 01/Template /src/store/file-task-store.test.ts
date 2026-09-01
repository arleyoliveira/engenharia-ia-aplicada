import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileTaskStore } from "./file-task-store.js";

async function createTempBaseDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "notas-api-file-store-"));
}

test("FileTaskStore deve persistir tarefas entre instancias", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    const firstInstance = new FileTaskStore(filePath);
    const created = firstInstance.create({ title: "primeira" });

    const secondInstance = new FileTaskStore(filePath);
    const listed = secondInstance.list("all");

    assert.equal(created.id, 1);
    assert.deepEqual(listed, [{ id: 1, title: "primeira", status: "open" }]);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("FileTaskStore deve manter nextId entre reinicializacoes", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    const firstInstance = new FileTaskStore(filePath);
    firstInstance.create({ title: "primeira" });

    const secondInstance = new FileTaskStore(filePath);
    const created = secondInstance.create({ title: "segunda" });

    assert.equal(created.id, 2);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("FileTaskStore deve refletir alteracoes de outra instancia", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    const firstInstance = new FileTaskStore(filePath);
    const secondInstance = new FileTaskStore(filePath);

    firstInstance.create({ title: "primeira" });
    const created = secondInstance.create({ title: "segunda" });
    firstInstance.complete(created.id);

    assert.deepEqual(secondInstance.list("done"), [
      { id: 2, title: "segunda", status: "done" }
    ]);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("FileTaskStore deve concluir e remover persistindo alteracoes", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    const firstInstance = new FileTaskStore(filePath);
    firstInstance.create({ title: "primeira" });
    firstInstance.create({ title: "segunda" });
    firstInstance.complete(1);
    firstInstance.remove(2);

    const secondInstance = new FileTaskStore(filePath);
    const listed = secondInstance.list("all");

    assert.deepEqual(listed, [{ id: 1, title: "primeira", status: "done" }]);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("FileTaskStore deve emitir evento de recuperacao quando arquivo estiver corrompido", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");
  const recoveries: string[] = [];

  try {
    await mkdir(join(baseDir, ".data"), { recursive: true });
    await writeFile(filePath, "{broken", "utf-8");

    new FileTaskStore(filePath, {
      onRecovery: ({ backupPath }) => {
        recoveries.push(backupPath);
      }
    });

    assert.equal(recoveries.length, 1);
    assert.equal(recoveries[0].includes("tasks.backup-"), true);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});
