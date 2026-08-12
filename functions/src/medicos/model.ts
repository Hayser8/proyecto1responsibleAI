import type {Timestamp} from "firebase-admin/firestore";

export interface Medico {
  nombre: string;
  especialidad: string;
  direccion: string;
  telefono: string;
  sitio_web: string;
  zona: string;
  place_id: string;
  fecha_recoleccion: Timestamp;
  keyword_usado: string;
}

export interface MedicoDto extends Omit<Medico, "fecha_recoleccion"> {
  fecha_recoleccion: string;
}
