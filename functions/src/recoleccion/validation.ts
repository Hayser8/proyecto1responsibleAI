import {HttpError} from "../shared/http.js";
import {canonicalSpecialty} from "../shared/specialties.js";

export interface RecolectarInput {
  keyword: string;
  zona: string;
  especialidad: string;
}

const ZONA_PATTERN = /^(?:[1-9]|1[0-9]|2[0-5])$/;

function invalidRequest(): never {
  throw new HttpError(400, "INVALID_REQUEST", "Solicitud inválida");
}

function normalizeString(value: unknown): string {
  if (typeof value !== "string") {
    return invalidRequest();
  }

  return value.trim().replace(/\s+/g, " ");
}

export function parseRecolectarInput(body: unknown): RecolectarInput {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return invalidRequest();
  }

  const candidate = body as Record<string, unknown>;
  const {keyword: rawKeyword, zona: rawZona, especialidad: rawEspecialidad} = candidate;
  const keyword = normalizeString(rawKeyword);
  const zona = normalizeString(rawZona);
  const normalizedEspecialidad = normalizeString(rawEspecialidad);
  const especialidad = canonicalSpecialty(normalizedEspecialidad);

  if (
    keyword.length < 3 ||
    keyword.length > 160 ||
    especialidad === undefined ||
    !ZONA_PATTERN.test(zona)
  ) {
    return invalidRequest();
  }

  return {keyword, zona, especialidad};
}
