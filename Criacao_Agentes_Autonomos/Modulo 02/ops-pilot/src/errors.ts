/** Erros de domínio do OpsPilot. Traduzidos em respostas na borda (CLI/HTTP). */

export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Configuração de ambiente ausente ou inválida (ex.: OPENROUTER_API_KEY, DATABASE_URL). */
export class ConfigError extends DomainError {
  constructor(message: string) {
    super("CONFIG_ERROR", message);
  }
}

/** Identificador ou chave natural não encontrado no store. */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super("NOT_FOUND", message);
  }
}

/** Estado inválido para a operação (ex.: transição não permitida). */
export class InvalidStateError extends DomainError {
  constructor(message: string) {
    super("INVALID_STATE", message);
  }
}

/** Limite de iterações da estratégia de raciocínio atingido. */
export class IterationLimitError extends DomainError {
  constructor(message: string) {
    super("ITERATION_LIMIT", message);
  }
}

/** Modelo não produziu saída estruturada válida (ex.: tool call ausente/malformada). */
export class ModelOutputError extends DomainError {
  constructor(message: string) {
    super("MODEL_OUTPUT_ERROR", message);
  }
}

/** Execução de chat excedeu o tempo máximo permitido na borda HTTP. */
export class ChatTimeoutError extends DomainError {
  constructor(timeoutMs: number) {
    super("CHAT_TIMEOUT", `A execução excedeu o limite de ${timeoutMs} ms.`);
  }
}

/** Traduz erros de domínio para mensagem de borda. Retorna null para erros não-dominio. */
export function toBoundaryMessage(error: unknown): string | null {
  if (error instanceof DomainError) {
    return `[${error.code}] ${error.message}`;
  }
  return null;
}
