import type {Request, Response} from "express";
import {afterEach, describe, expect, it, vi} from "vitest";
import {sanitizeAuditPayload, withRequestLogging} from "../../src/security/request-logging.js";

describe("request logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacts sensitive values and keeps payloads bounded", () => {
    const payload = sanitizeAuditPayload({
      keyword: "pediatra zona 10",
      apiKey: "do-not-log",
      nested: {authorization: "Bearer do-not-log"},
      longText: "x".repeat(2_500),
    }) as Record<string, unknown>;

    expect(payload).toEqual({
      keyword: "pediatra zona 10",
      apiKey: "[REDACTED]",
      nested: {authorization: "[REDACTED]"},
      longText: `${"x".repeat(1_000)}…`,
    });
  });

  it("logs route, method, time, status and safe payload", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const finishListeners: Array<() => void> = [];
    const response = {
      statusCode: 403,
      once(_event: string, listener: () => void) {
        finishListeners.push(listener);
        return response;
      },
    } as unknown as Response;
    const request = {
      method: "POST",
      body: {keyword: "pediatra", apiKey: "do-not-log"},
      query: {},
    } as unknown as Request;

    await withRequestLogging(async (_request, _response) => undefined, "recolectarMedicos")(request, response);
    finishListeners[0]?.();

    expect(info).toHaveBeenCalledWith(expect.stringContaining('"event":"api_call"'));
    const logged = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      route: "recolectarMedicos",
      method: "POST",
      status: 403,
      payload: {keyword: "pediatra", apiKey: "[REDACTED]"},
    });
    expect(logged.timestamp).toEqual(expect.any(String));
    expect(logged.durationMs).toEqual(expect.any(Number));
  });
});
