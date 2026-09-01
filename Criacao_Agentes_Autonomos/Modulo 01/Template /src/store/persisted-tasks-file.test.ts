import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { emptyPersistedTasks } from "../domain/persisted-tasks.js";
import {
  ensurePersistedTasksFile,
  loadPersistedTasksFile,
  readPersistedTasksFile,
  writePersistedTasksFile
} from "./persisted-tasks-file.js";

async function createTempBaseDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "notas-api-store-"));
}

test("ensurePersistedTasksFile deve criar diretorio e arquivo com estado vazio", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    await ensurePersistedTasksFile(filePath);
    const state = await readPersistedTasksFile(filePath);

    assert.deepEqual(state, emptyPersistedTasks);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("writePersistedTasksFile e readPersistedTasksFile devem manter estado", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    await writePersistedTasksFile(filePath, {
      nextId: 3,
      tasks: [
        { id: 1, title: "primeira", status: "open" },
        { id: 2, title: "segunda", status: "done" }
      ]
    });

    const state = await readPersistedTasksFile(filePath);

    assert.deepEqual(state, {
      nextId: 3,
      tasks: [
        { id: 1, title: "primeira", status: "open" },
        { id: 2, title: "segunda", status: "done" }
      ]
    });
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("writePersistedTasksFile deve serializar em JSON identado com quebra final", async () => {
  const baseDir = await createTempBaseDir();
  const filePath = join(baseDir, ".data", "tasks.json");

  try {
    await writePersistedTasksFile(filePath, {
      nextId: 1,
      tasks: []
    });

    const fileContent = await readFile(filePath, "utf-8");

    assert.equal(fileContent, '{\n  "nextId": 1,\n  "tasks": []\n}\n');
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("loadPersistedTasksFile deve criar backup e resetar quando JSON estiver corrompido", async () => {
  const baseDir = await createTempBaseDir();
  const dataDir = join(baseDir, ".data");
  const filePath = join(dataDir, "tasks.json");

  try {
    await ensurePersistedTasksFile(filePath);
    await writeFile(filePath, "{invalid-json", "utf-8");

    const loaded = await loadPersistedTasksFile(filePath, {
      now: () => new Date("2026-08-31T12:34:56.000Z")
    });

    assert.equal(loaded.recoveredFromCorruption, true);
    assert.equal(
      loaded.backupPath,
      join(dataDir, "tasks.backup-20260831123456.json")
    );
    assert.deepEqual(loaded.state, emptyPersistedTasks);

    const recovered = await readPersistedTasksFile(filePath);
    assert.deepEqual(recovered, emptyPersistedTasks);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("loadPersistedTasksFile deve manter apenas 1 backup mais recente", async () => {
  const baseDir = await createTempBaseDir();
  const dataDir = join(baseDir, ".data");
  const filePath = join(dataDir, "tasks.json");

  try {
    await ensurePersistedTasksFile(filePath);

    await writeFile(filePath, "{bad-1", "utf-8");
    await loadPersistedTasksFile(filePath, {
      now: () => new Date("2026-08-31T12:34:56.000Z")
    });

    await writeFile(filePath, "{bad-2", "utf-8");
    await loadPersistedTasksFile(filePath, {
      now: () => new Date("2026-08-31T12:34:57.000Z")
    });

    const files = await readdir(dataDir);
    const backups = files.filter((fileName) => fileName.startsWith("tasks.backup-"));

    assert.deepEqual(backups, ["tasks.backup-20260831123457.json"]);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});
