import {describe, expect, it} from "vitest";
import {HttpError, toErrorResult} from "../../src/shared/http.js";

describe("toErrorResult", () => {
  it("preserves controlled status and public message", () => {
    expect(toErrorResult(new HttpError(400, "INVALID_REQUEST", "Solicitud inválida"))).toEqual({
      status: 400,
      body: {error: {code: "INVALID_REQUEST", message: "Solicitud inválida"}},
    });
  });

  it("hides unexpected internal details", () => {
    expect(toErrorResult(new Error("secret stack detail"))).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
    });
  });
});
