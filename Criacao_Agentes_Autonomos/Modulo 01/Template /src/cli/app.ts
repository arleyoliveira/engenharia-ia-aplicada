import { runCliCommand, type CliExecutionResult } from "./runner.js";
import { TaskService } from "../service/task-service.js";
import { FileTaskStore } from "../store/file-task-store.js";

export type RunCliAppOptions = {
  dataFilePath: string;
};

export function runCliApp(args: string[], options: RunCliAppOptions): CliExecutionResult {
  const startupWarnings: string[] = [];

  const taskService = new TaskService(
    new FileTaskStore(options.dataFilePath, {
      onRecovery: ({ backupPath }) => {
        startupWarnings.push(
          `Arquivo de tarefas corrompido detectado. Backup criado em ${backupPath}. Estado reiniciado.`
        );
      }
    })
  );

  const result = runCliCommand(args, taskService);

  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: [...startupWarnings, ...result.stderr]
  };
}
