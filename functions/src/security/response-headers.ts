import type {HttpHandler} from "./http-handler.js";

const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Cache-Control", "no-store"],
  ["Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
];

export function withSecurityHeaders(next: HttpHandler): HttpHandler {
  return async (request, response) => {
    response.removeHeader("X-Powered-By");
    // Functions Framework puede volver a insertar su firma si la cabecera queda
    // ausente. Mantenerla vacía evita divulgar el framework en la respuesta final.
    response.setHeader("X-Powered-By", "");
    for (const [name, value] of SECURITY_HEADERS) {
      response.setHeader(name, value);
    }
    await next(request, response);
  };
}
