import type {Request, Response} from "express";
import {afterEach, describe, expect, it, vi} from "vitest";
import {withIpWhitelist, type HttpHandler} from "../../src/security/ip-whitelist.js";
import {withRateLimit, type RateLimitOptions} from "../../src/security/rate-limit.js";

interface CapturedResponse {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
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
  const captured: CapturedResponse = {headers: {}};
  const response = {
    setHeader(name: string, value: string) {
      captured.headers[name] = value;
      return response;
    },
    status(status: number) {
      captured.status = status;
      return response;
    },
    json(body: unknown) {
      captured.body = body;
      return response;
    },
  } as unknown as Response;
  return {response, captured};
}

function makeNext(calls: {count: number}): HttpHandler {
  return async () => {
    calls.count += 1;
  };
}

function makeClock(): {now: () => number; advance: (ms: number) => void; reads: () => number} {
  let current = 0;
  let reads = 0;
  return {
    now: () => {
      reads += 1;
      return current;
    },
    advance: (ms: number) => {
      current += ms;
    },
    reads: () => reads,
  };
}

function options(overrides: Partial<RateLimitOptions> = {}): RateLimitOptions {
  return {
    burst: 3,
    perMinute: 6,
    globalPerMinute: 1_000,
    maxKeys: 64,
    now: () => 0,
    ...overrides,
  };
}

async function call(handler: HttpHandler, request: Request): Promise<CapturedResponse> {
  const {response, captured} = makeResponse();
  await handler(request, response);
  return captured;
}

const authorized = makeRequest({forwardedFor: "203.0.113.10"});

describe("withRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("delegates while tokens remain", async () => {
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options());

    const captured = [
      await call(limited, authorized),
      await call(limited, authorized),
      await call(limited, authorized),
    ];

    expect(calls.count).toBe(3);
    expect(captured).toEqual([{headers: {}}, {headers: {}}, {headers: {}}]);
  });

  it("rejects with 429 RATE_LIMITED once the burst is spent", async () => {
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 1, perMinute: 6}));
    await call(limited, authorized);

    const captured = await call(limited, authorized);

    expect(captured).toEqual({
      headers: {"Retry-After": "10"},
      status: 429,
      body: {error: {code: "RATE_LIMITED", message: "Demasiadas solicitudes. Espere unos segundos."}},
    });
    expect(calls.count).toBe(1);
  });

  it.each([1, 2, 3])("allows exactly %i requests and blocks the next one", async (burst) => {
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst}));

    for (let attempt = 0; attempt < burst; attempt += 1) {
      await call(limited, authorized);
    }
    const captured = await call(limited, authorized);

    expect(calls.count).toBe(burst);
    expect(captured.status).toBe(429);
  });

  it("refills one token after the configured interval", async () => {
    const clock = makeClock();
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 1, perMinute: 60, now: clock.now}));
    await call(limited, authorized);

    clock.advance(999);
    expect((await call(limited, authorized)).status).toBe(429);

    clock.advance(1);
    expect((await call(limited, authorized)).status).toBeUndefined();
    expect(calls.count).toBe(2);
  });

  it("never accumulates more than the burst after a long idle period", async () => {
    const clock = makeClock();
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 3, perMinute: 60, now: clock.now}));
    await call(limited, authorized);

    clock.advance(60 * 60 * 1000);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await call(limited, authorized);
    }

    expect((await call(limited, authorized)).status).toBe(429);
    expect(calls.count).toBe(4);
  });

  it("keeps Retry-After truthful when a rejected client retries early", async () => {
    const clock = makeClock();
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1, perMinute: 6, now: clock.now}));
    await call(limited, authorized);

    expect((await call(limited, authorized)).headers["Retry-After"]).toBe("10");
    clock.advance(1_000);
    expect((await call(limited, authorized)).headers["Retry-After"]).toBe("9");

    clock.advance(9_000);
    expect((await call(limited, authorized)).status).toBeUndefined();
  });

  it("never emits a Retry-After below one second", async () => {
    const clock = makeClock();
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1, perMinute: 600, now: clock.now}));
    await call(limited, authorized);

    clock.advance(99);

    expect((await call(limited, authorized)).headers["Retry-After"]).toBe("1");
  });

  it("reads the injected clock exactly once per request", async () => {
    const clock = makeClock();
    const limited = withRateLimit(makeNext({count: 0}), options({now: clock.now}));
    const readsAfterConstruction = clock.reads();

    await call(limited, authorized);

    expect(clock.reads()).toBe(readsAfterConstruction + 1);
  });

  it("keeps a separate bucket per client IP", async () => {
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 1}));
    await call(limited, authorized);

    const other = await call(limited, makeRequest({forwardedFor: "198.51.100.7"}));

    expect(other.status).toBeUndefined();
    expect(calls.count).toBe(2);
  });

  it("uses the first X-Forwarded-For entry as the bucket key", async () => {
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.10, 198.51.100.1"}));

    const captured = await call(limited, makeRequest({forwardedFor: "203.0.113.10"}));

    expect(captured.status).toBe(429);
  });

  it.each([
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "0:0:0:0:0:ffff:127.0.0.1",
  ])("treats the IPv4-mapped address %s as the same bucket as 127.0.0.1", async (mapped) => {
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1}));
    await call(limited, makeRequest({forwardedFor: "127.0.0.1"}));

    const captured = await call(limited, makeRequest({forwardedFor: mapped}));

    expect(captured.status).toBe(429);
  });

  it("falls back to the socket remote address", async () => {
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1}));
    await call(limited, makeRequest({remoteAddress: "203.0.113.10"}));

    const captured = await call(limited, makeRequest({remoteAddress: "203.0.113.10"}));

    expect(captured.status).toBe(429);
  });

  it("groups requests without a client IP under a single bucket", async () => {
    vi.stubEnv("FUNCTIONS_EMULATOR", "false");
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 1}));
    await call(limited, makeRequest());

    const captured = await call(limited, makeRequest());

    expect(captured.status).toBe(429);
    expect(calls.count).toBe(1);
  });

  it("applies a global limit a rotating client cannot bypass", async () => {
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 10, globalPerMinute: 5}));

    for (let index = 0; index < 5; index += 1) {
      await call(limited, makeRequest({forwardedFor: `203.0.113.${index}`}));
    }
    const captured = await call(limited, makeRequest({forwardedFor: "203.0.113.99"}));

    expect(captured.status).toBe(429);
    expect(calls.count).toBe(5);
  });

  it("does not spend a global token when the per-IP limit already rejected", async () => {
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({burst: 1, globalPerMinute: 5}));
    await call(limited, authorized);
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await call(limited, authorized);
    }

    const fresh = await call(limited, makeRequest({forwardedFor: "198.51.100.7"}));

    expect(fresh.status).toBeUndefined();
    expect(calls.count).toBe(2);
  });

  it("does not spend the per-IP token when the global limit rejects", async () => {
    const clock = makeClock();
    const calls = {count: 0};
    const limited = withRateLimit(makeNext(calls), options({
      burst: 3,
      perMinute: 6,
      globalPerMinute: 10,
      now: clock.now,
    }));
    for (let index = 0; index < 10; index += 1) {
      await call(limited, makeRequest({forwardedFor: `203.0.113.${index % 4}`}));
    }
    expect(calls.count).toBe(10);

    const victim = makeRequest({forwardedFor: "198.51.100.7"});
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await call(limited, victim)).headers["Retry-After"]).toBe("6");
    }
    clock.advance(6_000);

    // Su propio cupo quedó intacto, así que al vencer el plazo anunciado entra y
    // conserva la ráfaga completa. Con el descuento anticipado recibiría otro 429.
    expect((await call(limited, victim)).status).toBeUndefined();
    expect(calls.count).toBe(11);
  });

  it("evicts the least recently seen key when the store is full", async () => {
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1, maxKeys: 2}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.1"}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.2"}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.3"}));

    const captured = await call(limited, makeRequest({forwardedFor: "203.0.113.1"}));

    expect(captured.status).toBeUndefined();
  });

  it("keeps a touched key from being evicted", async () => {
    const limited = withRateLimit(makeNext({count: 0}), options({burst: 1, maxKeys: 2}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.1"}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.2"}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.1"}));
    await call(limited, makeRequest({forwardedFor: "203.0.113.3"}));

    expect((await call(limited, makeRequest({forwardedFor: "203.0.113.1"}))).status).toBe(429);
    expect((await call(limited, makeRequest({forwardedFor: "203.0.113.2"}))).status).toBeUndefined();
  });

  it("awaits an asynchronous handler", async () => {
    const order: string[] = [];
    const limited = withRateLimit(async () => {
      await Promise.resolve();
      order.push("handler");
    }, options());

    await call(limited, authorized);
    order.push("after");

    expect(order).toEqual(["handler", "after"]);
  });

  it("counts a request whose handler rejects", async () => {
    const limited = withRateLimit(async () => {
      throw new Error("fallo del handler");
    }, options({burst: 1}));

    await expect(call(limited, authorized)).rejects.toThrow("fallo del handler");

    expect((await call(limited, authorized)).status).toBe(429);
  });

  it("keeps two wrappers independent", async () => {
    const calls = {count: 0};
    const first = withRateLimit(makeNext(calls), options({burst: 1}));
    const second = withRateLimit(makeNext(calls), options({burst: 1}));
    await call(first, authorized);

    expect((await call(first, authorized)).status).toBe(429);
    expect((await call(second, authorized)).status).toBeUndefined();
    expect(calls.count).toBe(2);
  });

  it("lets the whitelist reject before the limiter records anything", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(
      withRateLimit(makeNext(calls), options({burst: 10, globalPerMinute: 2})),
      () => ["203.0.113.10"],
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const rejected = await call(secured, makeRequest({forwardedFor: "198.51.100.1"}));
      expect(rejected.status).toBe(403);
    }

    expect((await call(secured, authorized)).status).toBeUndefined();
    expect((await call(secured, authorized)).status).toBeUndefined();
    expect(calls.count).toBe(2);
  });

  it("still rate limits an authorized client behind the whitelist", async () => {
    const calls = {count: 0};
    const secured = withIpWhitelist(
      withRateLimit(makeNext(calls), options({burst: 1})),
      () => ["203.0.113.10"],
    );
    await call(secured, authorized);

    const captured = await call(secured, authorized);

    expect(captured.status).toBe(429);
    expect(captured.body).toEqual({
      error: {code: "RATE_LIMITED", message: "Demasiadas solicitudes. Espere unos segundos."},
    });
    expect(calls.count).toBe(1);
  });
});
