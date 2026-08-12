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

initializeApp();

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
  withIpWhitelist(
    createRecolectarHandler({
      collect: collectionService.collect,
      getApiKey: () => placesApiKey.value(),
    }),
    () => ipWhitelist.value(),
  ),
);

export const directorio = onRequest(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  createDirectoryHandler(reader),
);
