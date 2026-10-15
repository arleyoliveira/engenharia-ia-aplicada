import type { Server } from "node:http";

import { TaskService } from "../service/task-service.js";
import { FileTaskStore } from "../store/file-task-store.js";
import { createTaskHttpServer } from "./server.js";

export type CreateHttpAppOptions = {
  dataFilePath: string;
  onRecoveryLog?: (message: string) => void;
};

export function createHttpApp(options: CreateHttpAppOptions): Server {
  const onRecoveryLog = options.onRecoveryLog ?? ((message: string) => console.warn(message));

  const taskService = new TaskService(
    new FileTaskStore(options.dataFilePath, {
      onRecovery: ({ backupPath }) => {
        onRecoveryLog(
          `Arquivo de tarefas corrompido detectado. Backup criado em ${backupPath}. Estado reiniciado.`
        );
      }
    })
  );

  return createTaskHttpServer(taskService);
}
