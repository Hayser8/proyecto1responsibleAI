import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";
import {defineJsonSecret, defineSecret} from "firebase-functions/params";
import {onRequest} from "firebase-functions/v2/https";
import {createDirectoryHandler} from "./directorio/handler.js";
import {createFirestoreMedicosReader} from "./directorio/repository.js";
import {createRecolectarHandler} from "./recoleccion/handler.js";
import {createPlacesClient} from "./recoleccion/places-client.js";
import {createFirestoreMedicosWriter} from "./recoleccion/repository.js";
import {createCollectionService} from "./recoleccion/service.js";
import {withIpWhitelist} from "./security/ip-whitelist.js";
import {withRateLimit} from "./security/rate-limit.js";
import {withRequestLogging} from "./security/request-logging.js";

initializeApp();

// Mitigación de ráfagas por instancia. No es un límite global garantizado: cada
// instancia mantiene su propio contador y ambas Functions escalan a cero, así que el
// techo real es el límite multiplicado por maxInstances. Ver docs/rate-limit.md.
const RECOLECCION_RATE_LIMIT = {burst: 3, perMinute: 6, globalPerMinute: 10, maxKeys: 64, now: Date.now};
const DIRECTORIO_RATE_LIMIT = {burst: 30, perMinute: 30, globalPerMinute: 120, maxKeys: 1_000, now: Date.now};

const placesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");
const ipWhitelist = defineJsonSecret("IP_WHITELIST");
const places = createPlacesClient(fetch);
const writer = createFirestoreMedicosWriter(getFirestore(), Timestamp.now);
const reader = createFirestoreMedicosReader(getFirestore());
const collectionService = createCollectionService({places, writer});

export const recolectarMedicos = onRequest(
  {
    region: "us-central1",
    secrets: [placesApiKey, ipWhitelist],
    maxInstances: 2,
    timeoutSeconds: 60,
  },
  // El limitador va por dentro de la whitelist: docs/ip-whitelist.md afirma que una IP
  // no autorizada recibe 403 antes de cualquier otra cosa. Invertir el orden devolvería
  // 429 a tráfico no autorizado y dejaría que internet poblara el mapa de buckets.
  withRequestLogging(
    withIpWhitelist(
      withRateLimit(
        createRecolectarHandler({
          collect: collectionService.collect,
          getApiKey: () => placesApiKey.value(),
        }),
        RECOLECCION_RATE_LIMIT,
      ),
      () => ipWhitelist.value(),
    ),
    "recolectarMedicos",
  ),
);

export const directorio = onRequest(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  withRequestLogging(
    withRateLimit(createDirectoryHandler(reader), DIRECTORIO_RATE_LIMIT),
    "directorio",
  ),
);
