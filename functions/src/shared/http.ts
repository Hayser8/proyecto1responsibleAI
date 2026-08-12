import type {Response} from "express";

/** Error that can be represented safely in an HTTP response. */
export class HttpError extends Error {
  /**
   * Creates a controlled error for a client-facing HTTP response.
   * @param {number} status HTTP status code to return.
   * @param {string} message Safe message for the API consumer.
   * @param {string} code Stable code clients can use to handle the error.
   */
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "internal-error",
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Sends a predictable, non-sensitive error response to API consumers.
 * @param {Response} response Express response object.
 * @param {unknown} error Error that was produced while handling the request.
 */
export function sendHttpError(response: Response, error: unknown): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {code: error.code, message: error.message},
    });
    return;
  }

  response.status(500).json({
    error: {
      code: "internal-error",
      message: "Ocurrió un error inesperado.",
    },
  });
}
