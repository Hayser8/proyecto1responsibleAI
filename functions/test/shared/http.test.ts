import {describe, expect, it, vi} from "vitest";
import {HttpError, sendHttpError} from "../../src/shared/http";

function responseDouble() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({json});
  return {status, json};
}

describe("sendHttpError", () => {
  it("returns safe details for an expected HTTP error", () => {
    const response = responseDouble();

    sendHttpError(response as never, new HttpError(400, "Filtro inválido", "invalid-argument"));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: {code: "invalid-argument", message: "Filtro inválido"},
    });
  });

  it("does not expose unexpected error details", () => {
    const response = responseDouble();

    sendHttpError(response as never, new Error("database password leaked"));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: {code: "internal-error", message: "Ocurrió un error inesperado."},
    });
  });
});
