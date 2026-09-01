import {
  access,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile
} from "node:fs/promises";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname } from "node:path";

import {
  emptyPersistedTasks,
  persistedTasksSchema,
  type PersistedTasks
} from "../domain/persisted-tasks.js";

function serializePersistedTasks(state: PersistedTasks): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

function formatBackupTimestamp(now: Date): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hour = String(now.getUTCHours()).padStart(2, "0");
  const minute = String(now.getUTCMinutes()).padStart(2, "0");
  const second = String(now.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}${hour}${minute}${second}`;
}

function getBackupFileName(now: Date): string {
  return `tasks.backup-${formatBackupTimestamp(now)}.json`;
}

function isBackupFileName(fileName: string): boolean {
  return /^tasks\.backup-\d{14}\.json$/.test(fileName);
}

async function enforceBackupRetention(dirPath: string, maxBackups: number): Promise<void> {
  const files = await readdir(dirPath);
  const backups = files.filter((fileName) => isBackupFileName(fileName)).sort();

  if (backups.length <= maxBackups) {
    return;
  }

  const filesToDelete = backups.slice(0, backups.length - maxBackups);
  await Promise.all(filesToDelete.map((fileName) => unlink(`${dirPath}/${fileName}`)));
}

function enforceBackupRetentionSync(dirPath: string, maxBackups: number): void {
  const files = readdirSync(dirPath);
  const backups = files.filter((fileName) => isBackupFileName(fileName)).sort();

  if (backups.length <= maxBackups) {
    return;
  }

  const filesToDelete = backups.slice(0, backups.length - maxBackups);
  for (const fileName of filesToDelete) {
    unlinkSync(`${dirPath}/${fileName}`);
  }
}

export type PersistedTasksFileOptions = {
  now?: () => Date;
  maxBackups?: number;
};

export type PersistedTasksLoadResult = {
  state: PersistedTasks;
  recoveredFromCorruption: boolean;
  backupPath?: string;
};

const DEFAULT_MAX_BACKUPS = 1;

export async function ensurePersistedTasksFile(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  try {
    await access(filePath);
  } catch {
    await writeFile(filePath, serializePersistedTasks(emptyPersistedTasks), "utf-8");
  }
}

export async function readPersistedTasksFile(filePath: string): Promise<PersistedTasks> {
  const loaded = await loadPersistedTasksFile(filePath);
  return loaded.state;
}

export async function writePersistedTasksFile(
  filePath: string,
  state: PersistedTasks
): Promise<void> {
  await ensurePersistedTasksFile(filePath);

  const parsed = persistedTasksSchema.parse(state);
  await writeFile(filePath, serializePersistedTasks(parsed), "utf-8");
}

export async function loadPersistedTasksFile(
  filePath: string,
  options: PersistedTasksFileOptions = {}
): Promise<PersistedTasksLoadResult> {
  await ensurePersistedTasksFile(filePath);

  const now = options.now ?? (() => new Date());
  const maxBackups = options.maxBackups ?? DEFAULT_MAX_BACKUPS;
  const fileDir = dirname(filePath);
  const raw = await readFile(filePath, "utf-8");

  try {
    const parsed = JSON.parse(raw);
    return {
      state: persistedTasksSchema.parse(parsed),
      recoveredFromCorruption: false
    };
  } catch {
    const backupFileName = getBackupFileName(now());
    const backupPath = `${fileDir}/${backupFileName}`;

    await writeFile(backupPath, raw, "utf-8");
    await writePersistedTasksFile(filePath, emptyPersistedTasks);
    await enforceBackupRetention(fileDir, maxBackups);

    return {
      state: emptyPersistedTasks,
      recoveredFromCorruption: true,
      backupPath
    };
  }
}

export function readPersistedTasksFileSync(filePath: string): PersistedTasks {
  return loadPersistedTasksFileSync(filePath).state;
}

export function writePersistedTasksFileSync(filePath: string, state: PersistedTasks): void {
  ensurePersistedTasksFileSync(filePath);

  const parsed = persistedTasksSchema.parse(state);
  writeFileSync(filePath, serializePersistedTasks(parsed), "utf-8");
}

export function ensurePersistedTasksFileSync(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });

  if (!existsSync(filePath)) {
    writeFileSync(filePath, serializePersistedTasks(emptyPersistedTasks), "utf-8");
  }
}

export function loadPersistedTasksFileSync(
  filePath: string,
  options: PersistedTasksFileOptions = {}
): PersistedTasksLoadResult {
  ensurePersistedTasksFileSync(filePath);

  const now = options.now ?? (() => new Date());
  const maxBackups = options.maxBackups ?? DEFAULT_MAX_BACKUPS;
  const fileDir = dirname(filePath);
  const raw = readFileSync(filePath, "utf-8");

  try {
    const parsed = JSON.parse(raw);
    return {
      state: persistedTasksSchema.parse(parsed),
      recoveredFromCorruption: false
    };
  } catch {
    const backupFileName = getBackupFileName(now());
    const backupPath = `${fileDir}/${backupFileName}`;

    writeFileSync(backupPath, raw, "utf-8");
    writePersistedTasksFileSync(filePath, emptyPersistedTasks);
    enforceBackupRetentionSync(fileDir, maxBackups);

    return {
      state: emptyPersistedTasks,
      recoveredFromCorruption: true,
      backupPath
    };
  }
}

