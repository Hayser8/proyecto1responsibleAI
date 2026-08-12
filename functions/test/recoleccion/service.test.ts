import {describe, expect, it} from "vitest";
import type {PlaceCandidate, PlacesClient} from "../../src/recoleccion/places-client.js";
import type {MedicosWriter} from "../../src/recoleccion/repository.js";
import {createCollectionService} from "../../src/recoleccion/service.js";
import type {RecolectarInput} from "../../src/recoleccion/validation.js";

const input: RecolectarInput = {
  keyword: "pediatra zona 10 Ciudad de Guatemala",
  zona: "10",
  especialidad: "Pediatría",
};

describe("createCollectionService", () => {
  it("searches and saves once, then returns the collection summary", async () => {
    const candidates: PlaceCandidate[] = Array.from({length: 20}, (_, index) => ({
      id: `place-${index + 1}`,
    }));
    const searches: Array<{keyword: string; apiKey: string}> = [];
    const saves: Array<{candidates: PlaceCandidate[]; input: RecolectarInput}> = [];
    const places: PlacesClient = {
      async search(keyword, apiKey) {
        searches.push({keyword, apiKey});
        return candidates;
      },
    };
    const writer: MedicosWriter = {
      async save(receivedCandidates, receivedInput) {
        saves.push({candidates: receivedCandidates, input: receivedInput});
        return {creados: 18, actualizados: 2};
      },
    };

    const result = await createCollectionService({places, writer}).collect(input, "test-api-key");

    expect(result).toEqual({
      keyword: "pediatra zona 10 Ciudad de Guatemala",
      zona: "10",
      especialidad: "Pediatría",
      encontrados: 20,
      creados: 18,
      actualizados: 2,
    });
    expect(searches).toEqual([{
      keyword: "pediatra zona 10 Ciudad de Guatemala",
      apiKey: "test-api-key",
    }]);
    expect(saves).toEqual([{candidates, input}]);
  });

  it("does not invoke the writer when Places finds no candidates", async () => {
    let writes = 0;
    const places: PlacesClient = {
      async search() {
        return [];
      },
    };
    const writer: MedicosWriter = {
      async save() {
        writes += 1;
        return {creados: 0, actualizados: 0};
      },
    };

    const result = await createCollectionService({places, writer}).collect(input, "test-api-key");

    expect(result).toEqual({
      keyword: "pediatra zona 10 Ciudad de Guatemala",
      zona: "10",
      especialidad: "Pediatría",
      encontrados: 0,
      creados: 0,
      actualizados: 0,
    });
    expect(writes).toBe(0);
  });
});
