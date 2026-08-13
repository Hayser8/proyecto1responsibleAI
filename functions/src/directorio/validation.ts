import {HttpError} from "../shared/http.js";
import {canonicalSpecialty} from "../shared/specialties.js";

export interface DirectoryQuery {
  page: number;
  pageSize: number;
  especialidad?: string;
  zona?: string;
}

const ZONA_PATTERN = /^(?:[1-9]|1[0-9]|2[0-5])$/;
const MAX_FIRESTORE_OFFSET = 2_147_483_647;

function invalidRequest(): never {
  throw new HttpError(400, "INVALID_REQUEST", "Solicitud inválida");
}

function parsePositiveInteger(value: unknown, fallback: number, maximum?: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return invalidRequest();
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (maximum !== undefined && parsed > maximum)) {
    return invalidRequest();
  }
  return parsed;
}

function parseOptionalFilter(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    return invalidRequest();
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function parseDirectoryQuery(query: Record<string, unknown>): DirectoryQuery {
  const page = parsePositiveInteger(query.page, 1);
  const pageSize = parsePositiveInteger(query.pageSize, 20, 50);
  const offset = (page - 1) * pageSize;

  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_FIRESTORE_OFFSET) {
    return invalidRequest();
  }

  const especialidad = parseOptionalFilter(query.especialidad);
  const zona = parseOptionalFilter(query.zona);

  const canonical = especialidad === undefined ? undefined : canonicalSpecialty(especialidad);
  if (especialidad !== undefined && canonical === undefined) {
    return invalidRequest();
  }

  if (zona !== undefined && !ZONA_PATTERN.test(zona)) {
    return invalidRequest();
  }

  return {
    page,
    pageSize,
    ...(canonical === undefined ? {} : {especialidad: canonical}),
    ...(zona === undefined ? {} : {zona}),
  };
}
