export type EstadoComunicado = "publicado" | "borrador" | "archivado";

export interface ArchivoAdjunto {
  idAdjunto?: string;
  nombre: string;
  url: string;
  tipo?: string;
}

export interface Comunicado {
  idComunicado: string | number;
  tipo?: "texto" | "imagen" | "pdf";
  titulo: string;
  contenido: string;
  resumen: string;
  categoria: string;
  fechaPublicacion: string; // ISO date
  estado: EstadoComunicado;
  adjuntos: ArchivoAdjunto[];
}
