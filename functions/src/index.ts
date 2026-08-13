import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";
import {createDirectoryHandler} from "./directorio/handler.js";
import {createFirestoreMedicosReader} from "./directorio/repository.js";
import {createRecolectarHandler} from "./recoleccion/handler.js";
import {createPlacesClient} from "./recoleccion/places-client.js";
import {createFirestoreMedicosWriter} from "./recoleccion/repository.js";
import {createCollectionService} from "./recoleccion/service.js";
import {withRateLimit} from "./security/rate-limit.js";
import {withRequestLogging} from "./security/request-logging.js";
import {withSecurityHeaders} from "./security/response-headers.js";

initializeApp();

// Mitigación best-effort por instancia. No es una cuota global exacta y cada
// arranque en frío reinicia los buckets. Ver docs/rate-limit.md.
const RECOLECCION_RATE_LIMIT = {burst: 3, perMinute: 6, globalPerMinute: 10, maxKeys: 64, now: Date.now};
const DIRECTORIO_RATE_LIMIT = {burst: 30, perMinute: 30, globalPerMinute: 120, maxKeys: 1_000, now: Date.now};

const placesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");
const places = createPlacesClient(fetch);
const writer = createFirestoreMedicosWriter(getFirestore(), Timestamp.now);
const reader = createFirestoreMedicosReader(getFirestore());
const collectionService = createCollectionService({places, writer});

export const recolectarMedicos = onRequest(
  {
    region: "us-central1",
    secrets: [placesApiKey],
    maxInstances: 2,
    timeoutSeconds: 60,
  },
  // Solo POST consume el bucket. La clave de red no es una identidad ni un control
  // de autorización; el bucket global limita ráfagas aunque roten las claves.
  withSecurityHeaders(
    withRequestLogging(
      withRateLimit(
        createRecolectarHandler({
          collect: collectionService.collect,
          getApiKey: () => placesApiKey.value(),
        }),
        RECOLECCION_RATE_LIMIT,
        undefined,
        (request) => request.method === "POST",
      ),
      "recolectarMedicos",
      (request) => {
        if (typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) {
          return {};
        }
        const body = request.body as Record<string, unknown>;
        return {
          ...(typeof body.keyword === "string" ? {keyword: body.keyword} : {}),
          ...(typeof body.especialidad === "string" ? {especialidad: body.especialidad} : {}),
          ...(typeof body.zona === "string" ? {zona: body.zona} : {}),
        };
      },
    ),
  ),
);

export const directorio = onRequest(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  withSecurityHeaders(
    withRequestLogging(
      withRateLimit(
        createDirectoryHandler(reader),
        DIRECTORIO_RATE_LIMIT,
        undefined,
        (request) => request.method === "GET",
      ),
      "directorio",
    ),
  ),
);
