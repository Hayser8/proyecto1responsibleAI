import {Timestamp} from "firebase-admin/firestore";
import {describe, expect, it} from "vitest";
import {createFirestoreMedicosReader} from "../../src/directorio/repository.js";

type QueryOperation =
  | ["where", string, FirebaseFirestore.WhereFilterOp, unknown]
  | ["orderBy", string, FirebaseFirestore.OrderByDirection]
  | ["offset", number]
  | ["limit", number];

class FirestoreQuerySpy {
  readonly collectionPaths: string[] = [];
  readonly operations: QueryOperation[] = [];
  getCalls = 0;
  readonly firestore: FirebaseFirestore.Firestore;

  constructor(rows: FirebaseFirestore.DocumentData[]) {
    const query = {
      where: (field: string, operator: FirebaseFirestore.WhereFilterOp, value: unknown) => {
        this.operations.push(["where", field, operator, value]);
        return query;
      },
      orderBy: (field: string, direction: FirebaseFirestore.OrderByDirection) => {
        this.operations.push(["orderBy", field, direction]);
        return query;
      },
      offset: (amount: number) => {
        this.operations.push(["offset", amount]);
        return query;
      },
      limit: (amount: number) => {
        this.operations.push(["limit", amount]);
        return query;
      },
      get: async () => {
        this.getCalls += 1;
        return {
          docs: rows.map((row) => ({data: () => row})),
        };
      },
    };

    this.firestore = {
      collection: (path: string) => {
        this.collectionPaths.push(path);
        return query;
      },
    } as unknown as FirebaseFirestore.Firestore;
  }
}

function medicoRow(sequence: number): FirebaseFirestore.DocumentData {
  return {
    nombre: `Médico ${sequence}`,
    especialidad: "Pediatría",
    direccion: `Dirección ${sequence}`,
    telefono: `+502 2200-${sequence.toString().padStart(4, "0")}`,
    sitio_web: `https://medico-${sequence}.example/`,
    zona: "10",
    place_id: `place-${sequence}`,
    fecha_recoleccion: Timestamp.fromMillis(1_786_000_000_000 + sequence),
    keyword_usado: "pediatra zona 10",
    secreto_interno: `no-exponer-${sequence}`,
  };
}

describe("createFirestoreMedicosReader", () => {
  it("builds the filtered, stable, paginated query in the required order", async () => {
    const fake = new FirestoreQuerySpy([medicoRow(1)]);
    const reader = createFirestoreMedicosReader(fake.firestore);

    await reader.list({page: 3, pageSize: 10, especialidad: "Pediatría", zona: "10"});

    expect(fake.collectionPaths).toEqual(["medicos"]);
    expect(fake.operations).toEqual([
      ["where", "especialidad", "==", "Pediatría"],
      ["where", "zona", "==", "10"],
      ["orderBy", "nombre", "asc"],
      ["orderBy", "place_id", "asc"],
      ["offset", 20],
      ["limit", 11],
    ]);
    expect(fake.getCalls).toBe(1);
  });

  it("omits absent filters while preserving order, offset, and extra-row limit", async () => {
    const fake = new FirestoreQuerySpy([]);
    const reader = createFirestoreMedicosReader(fake.firestore);

    const result = await reader.list({page: 1, pageSize: 20});

    expect(fake.operations).toEqual([
      ["orderBy", "nombre", "asc"],
      ["orderBy", "place_id", "asc"],
      ["offset", 0],
      ["limit", 21],
    ]);
    expect(result).toEqual({
      data: [],
      pagination: {page: 1, pageSize: 20, returned: 0, hasNextPage: false},
      filters: {especialidad: null, zona: null},
    });
  });

  it("removes the extra row and uses it only to report a next page", async () => {
    const fake = new FirestoreQuerySpy([medicoRow(1), medicoRow(2), medicoRow(3)]);
    const reader = createFirestoreMedicosReader(fake.firestore);

    const result = await reader.list({page: 2, pageSize: 2, zona: "10"});

    expect(result.data.map(({place_id}) => place_id)).toEqual(["place-1", "place-2"]);
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 2,
      returned: 2,
      hasNextPage: true,
    });
    expect(result.filters).toEqual({especialidad: null, zona: "10"});
  });

  it("serializes timestamps to ISO and returns only known medical fields", async () => {
    const fake = new FirestoreQuerySpy([medicoRow(7)]);
    const reader = createFirestoreMedicosReader(fake.firestore);

    const result = await reader.list({page: 1, pageSize: 1, especialidad: "Pediatría"});

    expect(result.data).toEqual([{
      nombre: "Médico 7",
      especialidad: "Pediatría",
      direccion: "Dirección 7",
      telefono: "+502 2200-0007",
      sitio_web: "https://medico-7.example/",
      zona: "10",
      place_id: "place-7",
      fecha_recoleccion: "2026-08-06T07:06:40.007Z",
      keyword_usado: "pediatra zona 10",
    }]);
    expect(result.pagination.hasNextPage).toBe(false);
  });
});
