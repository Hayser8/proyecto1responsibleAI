import type {Request, Response} from "express";
import {afterEach, describe, expect, it, vi} from "vitest";
import {withIpWhitelist, type HttpHandler} from "../../src/security/ip-whitelist.js";

interface CapturedResponse {
  status?: number;
  body?: unknown;
}

interface RequestOptions {
  forwardedFor?: string | string[];
  remoteAddress?: string;
}

function makeRequest({forwardedFor, remoteAddress}: RequestOptions = {}): Request {
  return {
    headers: forwardedFor === undefined ? {} : {"x-forwarded-for": forwardedFor},
    socket: {remoteAddress},
  } as Request;
}

function makeResponse(): {response: Response; captured: CapturedResponse} {
  const captured: CapturedResponse = {};
  const response = {
    status(status: number) {
      captured.status = status;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  } as Response;
  return {response, captured};
}

function makeNext(calls: {count: number}): HttpHandler {
  return async () => {
    calls.count += 1;
  };
}

describe("withIpWhitelist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("delegates exactly once for an authorized client IP", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest({remoteAddress: "203.0.113.10"}), response);

    expect(calls.count).toBe(1);
    expect(captured).toEqual({});
  });

  it("rejects an unauthorized client without delegating", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest({remoteAddress: "198.51.100.1"}), response);

    expect(captured).toEqual({
      status: 403,
      body: {error: {code: "IP_FORBIDDEN", message: "IP no autorizada"}},
    });
    expect(calls.count).toBe(0);
  });

  it("rejects a request without a client IP in normal mode without delegating", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "false");
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest(), response);

    expect(captured).toEqual({
      status: 403,
      body: {error: {code: "IP_FORBIDDEN", message: "IP no autorizada"}},
    });
    expect(calls.count).toBe(0);
  });

  it("uses loopback for a missing client IP in emulator mode when loopback is allowed", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["127.0.0.1"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest(), response);

    expect(calls.count).toBe(1);
    expect(captured).toEqual({});
  });

  it("rejects a missing client IP in emulator mode when loopback is not allowed", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest(), response);

    expect(captured).toEqual({
      status: 403,
      body: {error: {code: "IP_FORBIDDEN", message: "IP no autorizada"}},
    });
    expect(calls.count).toBe(0);
  });

  it("ignora X-Forwarded-For en emulador y usa la conexión loopback", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "true");
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["127.0.0.1"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest({forwardedFor: "198.51.100.1"}), response);

    expect(captured).toEqual({});
    expect(calls.count).toBe(1);
  });

  it("rechaza una IP permitida aportada solo mediante X-Forwarded-For", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response} = makeResponse();

    await secured(makeRequest({forwardedFor: "203.0.113.10, 198.51.100.1"}), response);

    expect(calls.count).toBe(0);
  });

  it("falls back to the socket remote address when forwarding headers are absent", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response} = makeResponse();

    await secured(makeRequest({remoteAddress: "203.0.113.10"}), response);

    expect(calls.count).toBe(1);
  });

  it("no permite que X-Forwarded-For suplante la dirección de la conexión", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response, captured} = makeResponse();

    await secured(makeRequest({
      forwardedFor: "203.0.113.10",
      remoteAddress: "198.51.100.1",
    }), response);

    expect(captured.status).toBe(403);
    expect(calls.count).toBe(0);
  });

  it.each([
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "0:0:0:0:0:ffff:127.0.0.1",
    "0:0:0:0:0:ffff:7f00:1",
  ])("treats IPv4-mapped IPv6 %s as its equivalent IPv4 address", async (forwardedFor) => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["127.0.0.1"]);
    const {response} = makeResponse();

    await secured(makeRequest({remoteAddress: forwardedFor}), response);

    expect(calls.count).toBe(1);
  });

  it("treats equivalent IPv6 spellings as the same client", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["2001:db8:0:0:0:0:0:1"]);
    const {response} = makeResponse();

    await secured(makeRequest({remoteAddress: "2001:db8::1"}), response);

    expect(calls.count).toBe(1);
  });

  it.each([
    {allowed: "[2001:db8::1]", client: "2001:db8:0:0:0:0:0:1"},
    {allowed: "2001:db8:0:0:0:0:0:1", client: "[2001:db8::1]"},
  ])("treats one complete IPv6 bracket pair as equivalent: %#", async ({allowed, client}) => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => [allowed]);
    const {response} = makeResponse();

    await secured(makeRequest({remoteAddress: client}), response);

    expect(calls.count).toBe(1);
  });

  it.each(["[::1", "::1]", "[[::1]]", "[::1]:443", "203.0.113.10:443"]) (
    "rejects malformed bracket or port syntax from the client: %s",
    async (forwardedFor) => {
      const calls = {count: 0};
      const secured = withIpWhitelist(makeNext(calls), () => ["::1"]);
      const {response, captured} = makeResponse();

      await secured(makeRequest({remoteAddress: forwardedFor}), response);

      expect(captured.status).toBe(403);
      expect(calls.count).toBe(0);
    },
  );

  it.each(["[::1", "::1]", "[[::1]]", "[::1]:443", "203.0.113.10:443"]) (
    "fails closed for malformed bracket or port syntax in the allowlist: %s",
    async (allowed) => {
      const calls = {count: 0};
      const secured = withIpWhitelist(makeNext(calls), () => [allowed]);
      const {response, captured} = makeResponse();

      await secured(makeRequest({remoteAddress: "::1"}), response);

      expect(captured.status).toBe(500);
      expect(calls.count).toBe(0);
    },
  );

  it.each<string | string[]>(["", "not-an-ip", []])(
    "ignora un X-Forwarded-For inválido y usa loopback en el emulador: %#",
    async (forwardedFor) => {
      vi.stubEnv("FUNCTIONS_EMULATOR", "true");
      const calls = {count: 0};
      const secured = withIpWhitelist(makeNext(calls), () => ["127.0.0.1"]);
      const {response, captured} = makeResponse();

      await secured(makeRequest({forwardedFor}), response);

      expect(captured).toEqual({});
      expect(calls.count).toBe(1);
    },
  );

  it("ignora X-Forwarded-For aunque esté representado como arreglo", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => ["203.0.113.10"]);
    const {response} = makeResponse();

    await secured(makeRequest({
      forwardedFor: ["203.0.113.10, 198.51.100.1", "198.51.100.2"],
      remoteAddress: "198.51.100.2",
    }), response);

    expect(calls.count).toBe(0);
  });

  it("awaits an authorized asynchronous handler", async () => {
    let completed = false;
    const secured = withIpWhitelist(async () => {
      await Promise.resolve();
      completed = true;
    }, () => ["203.0.113.10"]);
    const {response} = makeResponse();

    await secured(makeRequest({remoteAddress: "203.0.113.10"}), response);

    expect(completed).toBe(true);
  });

  it.each([undefined, [], ["203.0.113.10", "not-an-ip"], ["203.0.113.10", 7]])(
    "returns a safe internal error for invalid allowlist configuration %#",
    async (config) => {
      const calls = {count: 0};
      const secured = withIpWhitelist(makeNext(calls), () => config);
      const {response, captured} = makeResponse();

      await secured(makeRequest({remoteAddress: "203.0.113.10"}), response);

      expect(captured).toEqual({
        status: 500,
        body: {error: {code: "INTERNAL", message: "Error interno"}},
      });
      expect(calls.count).toBe(0);
    },
  );

  it("does not permit an allowed socket when the allowlist is empty", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => []);
    const {response, captured} = makeResponse();

    await secured(makeRequest({remoteAddress: "203.0.113.10"}), response);

    expect(captured).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
    });
    expect(calls.count).toBe(0);
  });

  it("returns a safe internal error when the allowlist getter throws", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(makeNext(calls), () => {
      throw new Error("secret configuration detail");
    });
    const {response, captured} = makeResponse();

    await secured(makeRequest({remoteAddress: "203.0.113.10"}), response);

    expect(captured).toEqual({
      status: 500,
      body: {error: {code: "INTERNAL", message: "Error interno"}},
    });
    expect(calls.count).toBe(0);
  });
});
