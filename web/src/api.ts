import type {CollectionRequest, CollectionSummary, DirectoryPage} from "./types";

export interface DirectoryQuery {
  page: number;
  pageSize: number;
  especialidad?: string;
  zona?: string;
}

const SAFE_ERROR_MESSAGE = "No se pudo consultar el directorio. Intente de nuevo.";
const SAFE_COLLECTION_ERROR_MESSAGE = "No se pudo recolectar desde Google Places. Intente de nuevo.";

export class DirectoryApiError extends Error {
  constructor(message = SAFE_ERROR_MESSAGE) {
    super(message);
    this.name = "DirectoryApiError";
  }
}

export class CollectionApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectionApiError";
  }
}

function parseCollectionSummary(payload: unknown, input: CollectionRequest): CollectionSummary {
  if (
    typeof payload !== "object"
    || payload === null
    || Array.isArray(payload)
  ) {
    throw new CollectionApiError(SAFE_COLLECTION_ERROR_MESSAGE);
  }

  const summary = payload as Record<string, unknown>;
  const hasValidCount = (value: unknown): value is number => (
    typeof value === "number"
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= 0
  );
  if (
    typeof summary.keyword !== "string"
    || summary.keyword !== input.keyword
    || typeof summary.especialidad !== "string"
    || summary.especialidad !== input.especialidad
    || typeof summary.zona !== "string"
    || summary.zona !== input.zona
    || !hasValidCount(summary.encontrados)
    || !hasValidCount(summary.creados)
    || !hasValidCount(summary.actualizados)
  ) {
    throw new CollectionApiError(SAFE_COLLECTION_ERROR_MESSAGE);
  }

  return {
    keyword: summary.keyword,
    especialidad: summary.especialidad,
    zona: summary.zona,
    encontrados: summary.encontrados,
    creados: summary.creados,
    actualizados: summary.actualizados,
  };
}

export async function fetchDirectory(
  query: DirectoryQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<DirectoryPage> {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.especialidad) params.set("especialidad", query.especialidad);
  if (query.zona) params.set("zona", query.zona);

  try {
    const response = await fetchImpl(`/directorio?${params.toString()}`, {
      headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new DirectoryApiError();
    return await response.json() as DirectoryPage;
  } catch (error) {
    if (error instanceof DirectoryApiError) throw error;
    throw new DirectoryApiError();
  }
}

export async function collectDoctors(
  input: CollectionRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<CollectionSummary> {
  try {
    const response = await fetchImpl("/recolectarMedicos", {
      method: "POST",
      headers: {Accept: "application/json", "Content-Type": "application/json"},
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      if (response.status === 400) {
        throw new CollectionApiError("Revise la keyword, especialidad y zona.");
      }
      if (response.status === 429) {
        throw new CollectionApiError("Se alcanzó la cuota de Google Places. Intente mañana.");
      }
      throw new CollectionApiError(SAFE_COLLECTION_ERROR_MESSAGE);
    }

    const payload: unknown = await response.json();
    return parseCollectionSummary(payload, input);
  } catch (error) {
    if (error instanceof CollectionApiError) throw error;
    throw new CollectionApiError(SAFE_COLLECTION_ERROR_MESSAGE);
  }
}
