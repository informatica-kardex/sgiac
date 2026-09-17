export type EstadoComunicado = "publicado" | "borrador" | "archivado";

export interface ArchivoAdjunto {
  nombre: string;
  url: string;
}

export interface Comunicado {
  idComunicado: number;
  titulo: string;
  contenido: string;
  resumen: string;
  categoria: string;
  fechaPublicacion: string; // ISO date
  estado: EstadoComunicado;
  adjuntos: ArchivoAdjunto[];
}
