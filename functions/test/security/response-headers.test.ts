import type {Request, Response} from "express";
import {describe, expect, it} from "vitest";
import {withSecurityHeaders} from "../../src/security/response-headers.js";

describe("withSecurityHeaders", () => {
  it("elimina la firma de Express y agrega cabeceras defensivas incluso en errores", async () => {
    const headers: Record<string, string> = {};
    const removed: string[] = [];
    const response = {
      removeHeader(name: string) {
        removed.push(name);
      },
      setHeader(name: string, value: string) {
        headers[name] = value;
        return response;
      },
    } as unknown as Response;

    const secured = withSecurityHeaders(async () => {
      throw new Error("fallo controlado");
    });

    await expect(secured({} as Request, response)).rejects.toThrow("fallo controlado");
    expect(removed).toContain("X-Powered-By");
    expect(headers).toMatchObject({
      "X-Powered-By": "",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });
});
