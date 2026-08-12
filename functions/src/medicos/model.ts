/** Data retained for a public medical-directory listing. */
export interface Medico {
  nombre: string;
  especialidad: string;
  direccion?: string;
  telefono?: string;
  sitio_web?: string;
  zona?: string;
  place_id: string;
  fecha_recoleccion: Date;
  keyword_usado: string;
}
