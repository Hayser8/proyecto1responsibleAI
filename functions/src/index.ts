import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {onRequest} from "firebase-functions/v2/https";
import {createDirectoryHandler} from "./directorio/handler.js";
import {createFirestoreMedicosReader} from "./directorio/repository.js";

initializeApp();

const reader = createFirestoreMedicosReader(getFirestore());

export const directorio = onRequest(
  {
    region: "us-central1",
    maxInstances: 5,
    timeoutSeconds: 30,
  },
  createDirectoryHandler(reader),
);
