import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runCliApp } from "./app.js";

async function createTempBaseDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "notas-api-cli-app-"));
}

test("runCliApp deve manter estado entre execucoes", async () => {
  const baseDir = await createTempBaseDir();
  const dataFilePath = join(baseDir, ".data", "tasks.json");

  try {
    const createResult = runCliApp(["tasks", "create", "--title", "persistir"], {
      dataFilePath
    });
    const listResult = runCliApp(["tasks", "list"], { dataFilePath });

    assert.equal(createResult.exitCode, 0);
    assert.equal(listResult.exitCode, 0);
    assert.deepEqual(listResult.stdout, ["1. [open] persistir"]);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});

test("runCliApp deve exibir mensagem de recuperacao ao detectar corrupcao", async () => {
  const baseDir = await createTempBaseDir();
  const dataDir = join(baseDir, ".data");
  const dataFilePath = join(dataDir, "tasks.json");

  try {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFilePath, "{broken", "utf-8");

    const result = runCliApp(["tasks", "list"], { dataFilePath });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr.length, 1);
    assert.equal(
      result.stderr[0].startsWith(
        "Arquivo de tarefas corrompido detectado. Backup criado em "
      ),
      true
    );
    assert.equal(result.stderr[0].endsWith(". Estado reiniciado."), true);
  } finally {
    await rm(baseDir, { recursive: true, force: true });
  }
});
