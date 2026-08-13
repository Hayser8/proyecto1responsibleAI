import type {Medico} from "../medicos/model.js";
import type {PlaceCandidate} from "./places-client.js";
import {collectionKeyword, type RecolectarInput} from "./validation.js";

const MAX_MEDICOS_PER_BATCH = 20;
const SOCIAL_NETWORK_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
]);

export interface SaveResult {
  creados: number;
  actualizados: number;
}

export interface MedicosWriter {
  save(candidates: PlaceCandidate[], input: RecolectarInput): Promise<SaveResult>;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isSocialNetworkWebsite(website: string): boolean {
  try {
    const hostname = new URL(website).hostname.toLowerCase().replace(/\.$/, "");
    return [...SOCIAL_NETWORK_HOSTS].some(
      (socialHost) => hostname === socialHost || hostname.endsWith(`.${socialHost}`),
    );
  } catch {
    return false;
  }
}

function websiteOrEmpty(value: unknown): string {
  const website = stringOrEmpty(value);
  return isSocialNetworkWebsite(website) ? "" : website;
}

function uniqueValidCandidates(candidates: PlaceCandidate[]): PlaceCandidate[] {
  const unique = new Map<string, PlaceCandidate>();

  for (const candidate of candidates) {
    const id = (candidate as {id?: unknown}).id;
    if (typeof id !== "string" || id.trim().length === 0 || id.includes("/") || unique.has(id)) {
      continue;
    }

    unique.set(id, candidate);
    if (unique.size === MAX_MEDICOS_PER_BATCH) {
      break;
    }
  }

  return [...unique.values()];
}

function toMedico(
  candidate: PlaceCandidate,
  input: RecolectarInput,
  collectedAt: FirebaseFirestore.Timestamp,
): Medico {
  return {
    nombre: stringOrEmpty(candidate.displayName?.text),
    especialidad: input.especialidad,
    direccion: stringOrEmpty(candidate.formattedAddress),
    telefono: stringOrEmpty(candidate.nationalPhoneNumber),
    sitio_web: websiteOrEmpty(candidate.websiteUri),
    zona: input.zona,
    place_id: candidate.id,
    fecha_recoleccion: collectedAt,
    keyword_usado: collectionKeyword(input),
  };
}

export function createFirestoreMedicosWriter(
  firestore: FirebaseFirestore.Firestore,
  now: () => FirebaseFirestore.Timestamp,
): MedicosWriter {
  return {
    async save(candidates: PlaceCandidate[], input: RecolectarInput): Promise<SaveResult> {
      const uniqueCandidates = uniqueValidCandidates(candidates);
      if (uniqueCandidates.length === 0) {
        return {creados: 0, actualizados: 0};
      }

      const collectedAt = now();
      const references = uniqueCandidates.map(({id}) => firestore.doc(`medicos/${id}`));
      const snapshots = await firestore.getAll(...references);
      const batch = firestore.batch();

      uniqueCandidates.forEach((candidate, index) => {
        batch.set(references[index], toMedico(candidate, input, collectedAt), {merge: true});
      });

      await batch.commit();

      const actualizados = snapshots.filter(({exists}) => exists).length;
      return {
        creados: uniqueCandidates.length - actualizados,
        actualizados,
      };
    },
  };
}
