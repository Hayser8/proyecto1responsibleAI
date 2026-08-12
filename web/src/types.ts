export interface MedicoDto {
  nombre: string;
  especialidad: string;
  direccion: string;
  telefono: string;
  sitio_web: string;
  zona: string;
  place_id: string;
  fecha_recoleccion: string;
  keyword_usado: string;
}

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

export interface CollectionRequest {
  keyword: string;
  especialidad: string;
  zona: string;
}

export interface CollectionSummary extends CollectionRequest {
  encontrados: number;
  creados: number;
  actualizados: number;
}
