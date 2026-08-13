import {initializeApp} from "firebase-admin/app";
import {getFirestore, Timestamp} from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Este comando solo puede ejecutarse con FIRESTORE_EMULATOR_HOST definido.");
}

const projectId = process.env.GCLOUD_PROJECT ?? "demo-proyecto1responsibleai";
initializeApp({projectId});

const firestore = getFirestore();
const collectedAt = Timestamp.now();
const demoRows = [
  {
    place_id: "demo-pediatria-zona-10",
    nombre: "Registro académico de demostración · Pediatría",
    especialidad: "Pediatría",
    direccion: "Dato ficticio para el emulador · zona 10",
    telefono: "",
    sitio_web: "",
    zona: "10",
    keyword_usado: "fixture-local",
  },
  {
    place_id: "demo-cardiologia-zona-9",
    nombre: "Registro académico de demostración · Cardiología",
    especialidad: "Cardiología",
    direccion: "Dato ficticio para el emulador · zona 9",
    telefono: "",
    sitio_web: "",
    zona: "9",
    keyword_usado: "fixture-local",
  },
];

const batch = firestore.batch();
for (const row of demoRows) {
  batch.set(firestore.collection("medicos").doc(row.place_id), {
    ...row,
    fecha_recoleccion: collectedAt,
  }, {merge: true});
}
await batch.commit();
console.log(`Se cargaron ${demoRows.length} registros ficticios en el emulador ${projectId}.`);
