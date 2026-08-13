import {clientIp} from "./ip-whitelist.js";
import type {HttpHandler} from "./http-handler.js";

type ErrorBody = {error: {code: string; message: string}};

const tooManyRequests: ErrorBody = {
  error: {code: "RATE_LIMITED", message: "Demasiadas solicitudes. Espere unos segundos."},
};

export interface RateLimitOptions {
  burst: number;
  perMinute: number;
  globalPerMinute: number;
  maxKeys: number;
  now: () => number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

// A diferencia de withIpWhitelist, aquí no se valida la configuración en runtime:
// la whitelist la recibe de Secret Manager y puede llegar mal escrita, mientras que
// estos límites son constantes de `index.ts` que revisa el compilador.

// Síncronas a propósito: sin un solo await entre leer y escribir los buckets. Cloud Run
// ejecuta la Function con concurrency 80, así que muchas peticiones comparten este
// estado; Node es monohilo y por eso el bloque resulta atómico. Un await lo rompería.

// Recarga el bucket hasta su capacidad y devuelve los tokens disponibles. No consume.
function refill(bucket: Bucket, capacity: number, ratePerMs: number, now: number): number {
  const tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * ratePerMs);
  bucket.tokens = tokens;
  bucket.updatedAt = now;
  return tokens;
}

// Segundos hasta que el bucket recupere un token entero. Nunca menos de uno.
function waitSeconds(tokens: number, ratePerMs: number): number {
  return Math.max(1, Math.ceil((1 - tokens) / ratePerMs / 1000));
}

export function withRateLimit(
  next: HttpHandler,
  options: RateLimitOptions,
  keyForRequest: (request: Parameters<HttpHandler>[0]) => string | undefined = clientIp,
  shouldLimit: (request: Parameters<HttpHandler>[0]) => boolean = () => true,
): HttpHandler {
  const ipRate = options.perMinute / 60_000;
  const globalRate = options.globalPerMinute / 60_000;
  const buckets = new Map<string, Bucket>();
  const shared: Bucket = {tokens: options.globalPerMinute, updatedAt: options.now()};

  return async (request, response) => {
    if (!shouldLimit(request)) {
      await next(request, response);
      return;
    }

    const now = options.now();
    const key = keyForRequest(request) ?? "sin-identidad";

    let bucket = buckets.get(key);
    if (bucket === undefined) {
      if (buckets.size >= options.maxKeys) {
        // Map conserva el orden de inserción, así que la primera clave es la menos
        // recientemente vista y desalojarla cuesta O(1).
        const oldest = buckets.keys().next();
        if (!oldest.done) {
          buckets.delete(oldest.value);
        }
      }
      bucket = {tokens: options.burst, updatedAt: now};
    } else {
      buckets.delete(key);
    }
    buckets.set(key, bucket);

    // Se recargan ambos buckets y se decide ANTES de consumir: si cualquiera de los dos
    // rechaza, ninguno gasta token. Descontarle a la IP para después rechazarla por el
    // bucket global drenaría a un cliente que jamás recibió respuesta y haría mentir a
    // Retry-After. Tampoco se gasta cupo global cuando la identidad ya fue rechazada.
    const ipTokens = refill(bucket, options.burst, ipRate, now);
    const globalTokens = refill(shared, options.globalPerMinute, globalRate, now);

    if (ipTokens < 1 || globalTokens < 1) {
      const retryAfter = ipTokens < 1
        ? waitSeconds(ipTokens, ipRate)
        : waitSeconds(globalTokens, globalRate);
      response.setHeader("Retry-After", String(retryAfter));
      response.status(429).json(tooManyRequests);
      return;
    }

    bucket.tokens = ipTokens - 1;
    shared.tokens = globalTokens - 1;

    await next(request, response);
  };
}
