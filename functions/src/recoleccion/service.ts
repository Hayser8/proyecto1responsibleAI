import type {PlacesClient} from "./places-client.js";
import type {MedicosWriter} from "./repository.js";
import type {RecolectarInput} from "./validation.js";

export interface CollectionSummary extends RecolectarInput {
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
      const candidates = await deps.places.search(input.keyword, apiKey);
      const saved = candidates.length === 0
        ? {creados: 0, actualizados: 0}
        : await deps.writer.save(candidates, input);

      return {
        ...input,
        encontrados: candidates.length,
        ...saved,
      };
    },
  };
}
