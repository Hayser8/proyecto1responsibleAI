import type {PlacesClient} from "./places-client.js";
import type {MedicosWriter} from "./repository.js";
import {collectionKeyword, type RecolectarInput} from "./validation.js";

export interface CollectionSummary extends RecolectarInput {
  keyword: string;
  encontrados: number;
  creados: number;
  actualizados: number;
}

export function createCollectionService(deps: {
  places: PlacesClient;
  writer: MedicosWriter;
}): {
  collect(input: RecolectarInput, apiKey: string): Promise<CollectionSummary>;
} {
  return {
    async collect(input, apiKey) {
      const candidates = await deps.places.search(input, apiKey);
      const saved = candidates.length === 0
        ? {creados: 0, actualizados: 0}
        : await deps.writer.save(candidates, input);

      return {
        ...input,
        keyword: collectionKeyword(input),
        encontrados: candidates.length,
        ...saved,
      };
    },
  };
}
