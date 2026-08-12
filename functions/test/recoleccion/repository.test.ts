import {Timestamp} from "firebase-admin/firestore";
import {describe, expect, it} from "vitest";
import type {Medico} from "../../src/medicos/model.js";
import type {PlaceCandidate} from "../../src/recoleccion/places-client.js";
import {createFirestoreMedicosWriter} from "../../src/recoleccion/repository.js";
import type {RecolectarInput} from "../../src/recoleccion/validation.js";

interface CapturedWrite {
  path: string;
  data: Medico;
  options: FirebaseFirestore.SetOptions;
}

class FakeFirestore {
  readonly writes: CapturedWrite[] = [];
  readonly getAllPaths: string[] = [];
  commits = 0;
  batches = 0;
  readonly firestore: FirebaseFirestore.Firestore;

  constructor(existingPaths: string[] = []) {
    const existing = new Set(existingPaths);
    const batch = {
      set: (
        reference: FirebaseFirestore.DocumentReference,
        data: FirebaseFirestore.DocumentData,
        options: FirebaseFirestore.SetOptions,
      ) => {
        this.writes.push({path: reference.path, data: data as Medico, options});
        return batch;
      },
      commit: async () => {
        this.commits += 1;
        return [];
      },
    };

    const firestore = {
      doc: (path: string) => ({path}) as FirebaseFirestore.DocumentReference,
      getAll: async (...references: FirebaseFirestore.DocumentReference[]) => {
        this.getAllPaths.push(...references.map(({path}) => path));
        return references.map((reference) => ({
          exists: existing.has(reference.path),
          ref: reference,
        })) as FirebaseFirestore.DocumentSnapshot[];
      },
      batch: () => {
        this.batches += 1;
        return batch as unknown as FirebaseFirestore.WriteBatch;
      },
    };

    this.firestore = firestore as unknown as FirebaseFirestore.Firestore;
  }
}

const input: RecolectarInput = {
  keyword: "pediatra zona 10 Ciudad de Guatemala",
  zona: "10",
  especialidad: "Pediatría",
};

describe("createFirestoreMedicosWriter", () => {
  it("maps only candidate and validated input fields, defaulting missing optional values", async () => {
    const fake = new FakeFirestore();
    const collectedAt = Timestamp.fromMillis(1_786_000_000_000);
    let clockCalls = 0;
    const writer = createFirestoreMedicosWriter(fake.firestore, () => {
      clockCalls += 1;
      return collectedAt;
    });

    const result = await writer.save([
      {
        id: "complete-place",
        displayName: {text: "Clínica Pediátrica"},
        formattedAddress: "Zona 10, Ciudad de Guatemala",
        nationalPhoneNumber: "+502 2222-2222",
        websiteUri: "https://clinica.example/",
      },
      {id: "minimal-place"},
    ], input);

    expect(result).toEqual({creados: 2, actualizados: 0});
    expect(clockCalls).toBe(1);
    expect(fake.writes).toEqual([
      {
        path: "medicos/complete-place",
        data: {
          nombre: "Clínica Pediátrica",
          especialidad: "Pediatría",
          direccion: "Zona 10, Ciudad de Guatemala",
          telefono: "+502 2222-2222",
          sitio_web: "https://clinica.example/",
          zona: "10",
          place_id: "complete-place",
          fecha_recoleccion: collectedAt,
          keyword_usado: "pediatra zona 10 Ciudad de Guatemala",
        },
        options: {merge: true},
      },
      {
        path: "medicos/minimal-place",
        data: {
          nombre: "",
          especialidad: "Pediatría",
          direccion: "",
          telefono: "",
          sitio_web: "",
          zona: "10",
          place_id: "minimal-place",
          fecha_recoleccion: collectedAt,
          keyword_usado: "pediatra zona 10 Ciudad de Guatemala",
        },
        options: {merge: true},
      },
    ]);
    expect(fake.getAllPaths).toEqual(["medicos/complete-place", "medicos/minimal-place"]);
    expect(fake.batches).toBe(1);
    expect(fake.commits).toBe(1);
  });

  it("skips candidates whose id is absent, non-string, empty, blank, or contains path separators", async () => {
    const fake = new FakeFirestore();
    const writer = createFirestoreMedicosWriter(fake.firestore, () => Timestamp.fromMillis(1));
    const candidates = [
      {},
      {id: null},
      {id: 42},
      {id: ""},
      {id: "   "},
      {id: "one/slash"},
      {id: "multiple/path/segments"},
      {id: "valid-place", displayName: {text: "Consultorio válido"}},
    ] as unknown as PlaceCandidate[];

    const result = await writer.save(candidates, input);

    expect(result).toEqual({creados: 1, actualizados: 0});
    expect(fake.writes.map(({path}) => path)).toEqual(["medicos/valid-place"]);
  });

  it.each([
    "https://facebook.com/clinica",
    "https://www.instagram.com/clinica",
    "https://tiktok.com/@clinica",
    "https://x.com/clinica",
    "https://mobile.twitter.com/clinica",
    "https://facebook.com./perfil",
  ])("does not persist prescribed social network URL %s as an official website", async (websiteUri) => {
    const fake = new FakeFirestore();
    const writer = createFirestoreMedicosWriter(fake.firestore, () => Timestamp.fromMillis(1));

    await writer.save([{id: "social-place", websiteUri}], input);

    expect(fake.writes[0]?.data.sitio_web).toBe("");
  });

  it("does not classify a non-social host or path text as a prescribed social network", async () => {
    const fake = new FakeFirestore();
    const writer = createFirestoreMedicosWriter(fake.firestore, () => Timestamp.fromMillis(1));

    await writer.save([
      {id: "lookalike", websiteUri: "https://facebook.com.example/clinic"},
      {id: "path-only", websiteUri: "https://clinic.example/facebook.com"},
    ], input);

    expect(fake.writes.map(({data}) => data.sitio_web)).toEqual([
      "https://facebook.com.example/clinic",
      "https://clinic.example/facebook.com",
    ]);
  });

  it("deduplicates place ids and reports exact created and updated counts", async () => {
    const fake = new FakeFirestore(["medicos/existing-place"]);
    const writer = createFirestoreMedicosWriter(fake.firestore, () => Timestamp.fromMillis(1));

    const result = await writer.save([
      {id: "new-place", displayName: {text: "Nuevo"}},
      {id: "existing-place", displayName: {text: "Existente"}},
      {id: "new-place", displayName: {text: "Duplicado"}},
    ], input);

    expect(result).toEqual({creados: 1, actualizados: 1});
    expect(fake.getAllPaths).toEqual(["medicos/new-place", "medicos/existing-place"]);
    expect(fake.writes.map(({path}) => path)).toEqual([
      "medicos/new-place",
      "medicos/existing-place",
    ]);
    expect(fake.commits).toBe(1);
  });

  it("writes at most 20 unique valid candidates", async () => {
    const fake = new FakeFirestore();
    const writer = createFirestoreMedicosWriter(fake.firestore, () => Timestamp.fromMillis(1));
    const candidates = Array.from({length: 21}, (_, index) => ({
      id: `place-${index + 1}`,
      displayName: {text: `Médico ${index + 1}`},
    }));

    const result = await writer.save(candidates, input);

    expect(result).toEqual({creados: 20, actualizados: 0});
    expect(fake.writes).toHaveLength(20);
    expect(fake.writes[19]?.path).toBe("medicos/place-20");
    expect(fake.writes.some(({path}) => path === "medicos/place-21")).toBe(false);
  });
});
