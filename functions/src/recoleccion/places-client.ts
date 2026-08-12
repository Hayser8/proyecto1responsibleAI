import {HttpError} from "../shared/http.js";

const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri";

export interface PlaceCandidate {
  id: string;
  displayName?: {text?: string};
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

export interface PlacesClient {
  search(keyword: string, apiKey: string): Promise<PlaceCandidate[]>;
}

interface PlacesSearchResponse {
  places?: unknown;
}

interface ProviderPlace {
  id?: unknown;
  displayName?: unknown;
  formattedAddress?: unknown;
  nationalPhoneNumber?: unknown;
  websiteUri?: unknown;
}

function toCandidate(place: ProviderPlace): PlaceCandidate | undefined {
  if (typeof place.id !== "string") {
    return undefined;
  }

  const candidate: PlaceCandidate = {id: place.id};
  if (typeof place.displayName === "object" && place.displayName !== null) {
    const text = (place.displayName as {text?: unknown}).text;
    if (typeof text === "string") {
      candidate.displayName = {text};
    }
  }
  if (typeof place.formattedAddress === "string") {
    candidate.formattedAddress = place.formattedAddress;
  }
  if (typeof place.nationalPhoneNumber === "string") {
    candidate.nationalPhoneNumber = place.nationalPhoneNumber;
  }
  if (typeof place.websiteUri === "string") {
    candidate.websiteUri = place.websiteUri;
  }
  return candidate;
}

function parseCandidates(payload: PlacesSearchResponse): PlaceCandidate[] {
  if (!Array.isArray(payload.places)) {
    return [];
  }
  return payload.places
    .slice(0, 20)
    .map((place) => (typeof place === "object" && place !== null ? toCandidate(place as ProviderPlace) : undefined))
    .filter((candidate): candidate is PlaceCandidate => candidate !== undefined);
}

export function createPlacesClient(fetchImpl: typeof fetch): PlacesClient {
  const safeErrors = new WeakSet<HttpError>();
  const createSafeError = (status: number, code: string, message: string): HttpError => {
    const error = new HttpError(status, code, message);
    safeErrors.add(error);
    return error;
  };

  return {
    async search(keyword: string, apiKey: string): Promise<PlaceCandidate[]> {
      try {
        const response = await fetchImpl(PLACES_TEXT_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": PLACES_FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery: keyword,
            pageSize: 20,
            languageCode: "es",
            regionCode: "GT",
          }),
        });

        if (response.status === 429) {
          throw createSafeError(429, "PLACES_QUOTA", "Cuota de Google Places agotada");
        }
        if (!response.ok) {
          throw createSafeError(502, "PLACES_ERROR", "No se pudo consultar Google Places");
        }

        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null) {
          throw createSafeError(502, "PLACES_ERROR", "No se pudo consultar Google Places");
        }
        return parseCandidates(payload as PlacesSearchResponse);
      } catch (error) {
        if (error instanceof HttpError && safeErrors.has(error)) {
          throw error;
        }
        throw createSafeError(502, "PLACES_ERROR", "No se pudo consultar Google Places");
      }
    },
  };
}
