import {deleteApp, initializeApp, type App} from "firebase-admin/app";
import {getFirestore, Timestamp, type Firestore} from "firebase-admin/firestore";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {createFirestoreMedicosReader} from "../../src/directorio/repository.js";
import type {PlaceCandidate} from "../../src/recoleccion/places-client.js";
import {createFirestoreMedicosWriter} from "../../src/recoleccion/repository.js";

const EMULATOR_HOST = "127.0.0.1:8080";
const PROJECT_ID = "proyecto1responsibleai";
const emulatorIsConfigured = process.env.FIRESTORE_EMULATOR_HOST === EMULATOR_HOST;

const candidates: PlaceCandidate[] = [
  {id: "pediatra-01", displayName: {text: "Pediatra 01"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-02", displayName: {text: "Pediatra 02"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-03", displayName: {text: "Pediatra 03"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-04", displayName: {text: "Pediatra 04"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-05", displayName: {text: "Pediatra 05"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-06", displayName: {text: "Pediatra 06"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-07", displayName: {text: "Pediatra 07"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-08", displayName: {text: "Pediatra 08"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-09", displayName: {text: "Pediatra 09"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-10", displayName: {text: "Pediatra 10"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-11", displayName: {text: "Pediatra 11"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-12", displayName: {text: "Pediatra 12"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-13", displayName: {text: "Pediatra 13"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-14", displayName: {text: "Pediatra 14"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-15", displayName: {text: "Pediatra 15"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-16", displayName: {text: "Pediatra 16"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-17", displayName: {text: "Pediatra 17"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-18", displayName: {text: "Pediatra 18"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-19", displayName: {text: "Pediatra 19"}, formattedAddress: "Zona 10, Guatemala"},
  {id: "pediatra-20", displayName: {text: "Pediatra 20"}, formattedAddress: "Zona 10, Guatemala"},
];

describe.runIf(emulatorIsConfigured)("Firestore emulator integration", () => {
  let app: App;
  let firestore: Firestore;

  async function clearMedicos(): Promise<void> {
    const snapshot = await firestore.collection("medicos").get();
    if (snapshot.empty) {
      return;
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
  }

  beforeAll(async () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBe(EMULATOR_HOST);
    app = initializeApp({projectId: PROJECT_ID}, "firestore-emulator-integration");
    firestore = getFirestore(app);
    await clearMedicos();
  });

  afterAll(async () => {
    await clearMedicos();
    await deleteApp(app);
  });

  it("keeps deterministic filtered pages and one document per place across inserts and updates", async () => {
    const writer = createFirestoreMedicosWriter(
      firestore,
      () => Timestamp.fromDate(new Date("2026-08-02T12:00:00.000Z")),
    );
    const reader = createFirestoreMedicosReader(firestore);
    const input = {keyword: "pediatras zona 10", especialidad: "Pediatría", zona: "10"};

    await expect(writer.save(candidates, input)).resolves.toEqual({creados: 20, actualizados: 0});
    await expect(writer.save(candidates.slice(0, 5), input)).resolves.toEqual({creados: 0, actualizados: 5});

    const firstPage = await reader.list({page: 1, pageSize: 10, especialidad: "Pediatría", zona: "10"});
    const secondPage = await reader.list({page: 2, pageSize: 10, especialidad: "Pediatría", zona: "10"});

    expect(firstPage.data.map(({place_id}) => place_id)).toEqual([
      "pediatra-01", "pediatra-02", "pediatra-03", "pediatra-04", "pediatra-05",
      "pediatra-06", "pediatra-07", "pediatra-08", "pediatra-09", "pediatra-10",
    ]);
    expect(firstPage.pagination).toEqual({page: 1, pageSize: 10, returned: 10, hasNextPage: true});
    expect(firstPage.filters).toEqual({especialidad: "Pediatría", zona: "10"});
    expect(secondPage.data.map(({place_id}) => place_id)).toEqual([
      "pediatra-11", "pediatra-12", "pediatra-13", "pediatra-14", "pediatra-15",
      "pediatra-16", "pediatra-17", "pediatra-18", "pediatra-19", "pediatra-20",
    ]);
    expect(secondPage.pagination).toEqual({page: 2, pageSize: 10, returned: 10, hasNextPage: false});
    expect(secondPage.filters).toEqual({especialidad: "Pediatría", zona: "10"});

    const stored = await firestore.collection("medicos").get();
    expect(stored.size).toBe(20);
    expect(new Set(stored.docs.map((document) => document.get("place_id"))).size).toBe(20);
    expect(stored.docs.every((document) => document.id === document.get("place_id"))).toBe(true);
  });
});
