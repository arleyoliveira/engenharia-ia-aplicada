import { DomainError } from "../domain/errors.js";

export type CliErrorResponse = {
  exitCode: number;
  message: string;
};

export function mapDomainErrorToCli(error: DomainError): CliErrorResponse {
  switch (error.code) {
    case "TASK_NOT_FOUND":
      return {
        exitCode: 1,
        message: error.message
      };
    default:
      return {
        exitCode: 1,
        message: "Unexpected domain error"
      };
  }
}
