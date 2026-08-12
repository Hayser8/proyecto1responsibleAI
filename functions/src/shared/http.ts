export interface HttpResult<T> {
  status: number;
  body: T;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function toErrorResult(error: unknown): HttpResult<{error: {code: string; message: string}}> {
  if (error instanceof HttpError) {
    return {status: error.status, body: {error: {code: error.code, message: error.message}}};
  }
  return {status: 500, body: {error: {code: "INTERNAL", message: "Error interno"}}};
}
