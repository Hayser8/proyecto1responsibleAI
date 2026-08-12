import type {MedicoDto} from "../medicos/model.js";
import type {DirectoryQuery} from "./validation.js";

export interface DirectoryPage {
  data: MedicoDto[];
  pagination: {
    page: number;
    pageSize: number;
    returned: number;
    hasNextPage: boolean;
  };
  filters: {
    especialidad: string | null;
    zona: string | null;
  };
}

export interface MedicosReader {
  list(query: DirectoryQuery): Promise<DirectoryPage>;
}

function toMedicoDto(data: FirebaseFirestore.DocumentData): MedicoDto {
  return {
    nombre: data.nombre,
    especialidad: data.especialidad,
    direccion: data.direccion,
    telefono: data.telefono,
    sitio_web: data.sitio_web,
    zona: data.zona,
    place_id: data.place_id,
    fecha_recoleccion: (data.fecha_recoleccion as FirebaseFirestore.Timestamp).toDate().toISOString(),
    keyword_usado: data.keyword_usado,
  };
}

export function createFirestoreMedicosReader(
  firestore: FirebaseFirestore.Firestore,
): MedicosReader {
  return {
    async list(query: DirectoryQuery): Promise<DirectoryPage> {
      let firestoreQuery: FirebaseFirestore.Query = firestore.collection("medicos");

      if (query.especialidad !== undefined) {
        firestoreQuery = firestoreQuery.where("especialidad", "==", query.especialidad);
      }
      if (query.zona !== undefined) {
        firestoreQuery = firestoreQuery.where("zona", "==", query.zona);
      }

      firestoreQuery = firestoreQuery
        .orderBy("nombre", "asc")
        .orderBy("place_id", "asc")
        .offset((query.page - 1) * query.pageSize)
        .limit(query.pageSize + 1);

      const snapshot = await firestoreQuery.get();
      const hasNextPage = snapshot.docs.length > query.pageSize;
      const data = snapshot.docs
        .slice(0, query.pageSize)
        .map((document) => toMedicoDto(document.data()));

      return {
        data,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          returned: data.length,
          hasNextPage,
        },
        filters: {
          especialidad: query.especialidad ?? null,
          zona: query.zona ?? null,
        },
      };
    },
  };
}
