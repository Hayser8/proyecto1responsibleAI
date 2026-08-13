import {isIP} from "node:net";
import type {Request} from "express";
import type {HttpHandler} from "./http-handler.js";

export type {HttpHandler} from "./http-handler.js";

type ErrorBody = {error: {code: string; message: string}};

const forbidden: ErrorBody = {
  error: {code: "IP_FORBIDDEN", message: "IP no autorizada"},
};

const internal: ErrorBody = {
  error: {code: "INTERNAL", message: "Error interno"},
};

function normalizeIpv4(ip: string): string {
  return ip.split(".").map((part) => Number(part).toString(10)).join(".");
}

function ipv4Groups(ip: string): number[] {
  const parts = normalizeIpv4(ip).split(".").map(Number);
  return [
    (parts[0] << 8) | parts[1],
    (parts[2] << 8) | parts[3],
  ];
}

function ipv6Groups(ip: string): number[] {
  const [left, right] = ip.toLowerCase().split("::");
  const leftGroups = left === "" ? [] : left.split(":");
  const rightGroups = right === undefined || right === "" ? [] : right.split(":");
  const expandIpv4 = (groups: string[]): Array<string | number> => {
    const last = groups.at(-1);
    return last !== undefined && isIP(last) === 4
      ? [...groups.slice(0, -1), ...ipv4Groups(last)]
      : groups;
  };
  const expandedLeft = expandIpv4(leftGroups);
  const expandedRight = expandIpv4(rightGroups);
  const omitted = 8 - expandedLeft.length - expandedRight.length;
  const groups = right === undefined
    ? expandedLeft
    : [...expandedLeft, ...Array<number>(omitted).fill(0), ...expandedRight];

  return groups.map((group) => typeof group === "number" ? group : Number.parseInt(group, 16));
}

function normalizeIpv6(ip: string): string {
  const groups = ipv6Groups(ip);
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [
      groups[6] >>> 8,
      groups[6] & 0xff,
      groups[7] >>> 8,
      groups[7] & 0xff,
    ].join(".");
  }

  return groups.map((group) => group.toString(16)).join(":");
}

function normalizeIp(value: string): string | undefined {
  const candidate = value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;
  const bracketed = candidate !== value;
  const version = isIP(candidate);
  if (bracketed && version !== 6) {
    return undefined;
  }
  if (version === 4) {
    return normalizeIpv4(candidate);
  }
  if (version !== 6) {
    return undefined;
  }

  return normalizeIpv6(candidate);
}

function allowedIps(value: unknown): Set<string> | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const normalized = value.map((entry) => typeof entry === "string" ? normalizeIp(entry) : undefined);
  return normalized.every((entry): entry is string => entry !== undefined)
    ? new Set(normalized)
    : undefined;
}

export function clientIp(request: Request): string | undefined {
  // X-Forwarded-For puede contener texto aportado por quien llama. Sin un borde
  // que lo reemplace y bloquee la URL directa no es una identidad confiable.
  const candidate = request.socket.remoteAddress ?? (
    process.env.FUNCTIONS_EMULATOR === "true" ? "127.0.0.1" : undefined
  );

  return candidate === undefined ? undefined : normalizeIp(candidate);
}

export function withIpWhitelist(
  next: HttpHandler,
  getAllowedIps: () => unknown,
): HttpHandler {
  return async (request, response) => {
    let allowed: Set<string> | undefined;
    try {
      allowed = allowedIps(getAllowedIps());
    } catch {
      response.status(500).json(internal);
      return;
    }

    if (allowed === undefined) {
      response.status(500).json(internal);
      return;
    }

    const client = clientIp(request);
    if (client === undefined || !allowed.has(client)) {
      response.status(403).json(forbidden);
      return;
    }

    await next(request, response);
  };
}
