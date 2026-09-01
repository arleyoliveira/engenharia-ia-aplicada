import { DomainError } from "../domain/errors.js";

export type HttpErrorResponse = {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
    };
  };
};

export function mapDomainErrorToHttp(error: DomainError): HttpErrorResponse {
  switch (error.code) {
    case "TASK_NOT_FOUND":
      return {
        status: 404,
        body: {
          error: {
            code: error.code,
            message: error.message
          }
        }
      };
    default:
      return {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_ERROR",
            message: "An unexpected domain error occurred"
          }
        }
      };
  }
}
