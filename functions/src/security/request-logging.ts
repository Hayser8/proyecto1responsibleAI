import {randomUUID} from "node:crypto";
import {appendFileSync, mkdirSync} from "node:fs";
import {dirname, join} from "node:path";
import type {Request, Response} from "express";
import type {HttpHandler} from "./http-handler.js";

const LOCAL_LOG_FILE = join(process.cwd(), "logs", "api-calls.ndjson");
const MAX_STRING_LENGTH = 1_000;
const MAX_OBJECT_KEYS = 40;
const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token|api[\s_-]?key/i;

export interface ApiCallLogEntry {
  event: "api_call";
  timestamp: string;
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  payload: unknown;
}

export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (value === undefined || value === null) return null;
  if (depth > 4) return "[TRUNCATED]";
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_OBJECT_KEYS).map((item) => sanitizeAuditPayload(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of entries.slice(0, MAX_OBJECT_KEYS)) {
      sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeAuditPayload(entry, depth + 1);
    }
    if (entries.length > MAX_OBJECT_KEYS) sanitized._truncated = true;
    return sanitized;
  }
  return `[${typeof value}]`;
}

function requestPayload(request: Request): unknown {
  return request.method === "GET" ? request.query : request.body;
}

function writeAuditLog(entry: ApiCallLogEntry): void {
  const line = JSON.stringify(entry);
  // Cloud Logging ingests this JSON line. It contains only the allow-listed request
  // payload and never headers, API keys, cookies, or authentication tokens.
  console.info(line);

  // The Functions filesystem is ephemeral in production. Persist a text log only
  // for the emulator, or when a local path was explicitly provided for diagnostics.
  const logFile = process.env.API_CALL_LOG_FILE ?? LOCAL_LOG_FILE;
  if (process.env.FUNCTIONS_EMULATOR !== "true" && process.env.API_CALL_LOG_FILE === undefined) return;

  mkdirSync(dirname(logFile), {recursive: true});
  appendFileSync(logFile, `${line}\n`, {encoding: "utf8"});
}

export function withRequestLogging(
  next: HttpHandler,
  route: string,
  payloadForRequest: (request: Request) => unknown = requestPayload,
): HttpHandler {
  return async (request, response) => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    let completed = false;

    const finalize = (): void => {
      if (completed) return;
      completed = true;
      writeAuditLog({
        event: "api_call",
        timestamp: new Date().toISOString(),
        requestId,
        route,
        method: request.method,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
        payload: sanitizeAuditPayload(payloadForRequest(request)),
      });
    };

    response.once("finish", finalize);
    response.once("close", finalize);
    try {
      await next(request, response);
    } catch (error) {
      finalize();
      throw error;
    }
  };
}
