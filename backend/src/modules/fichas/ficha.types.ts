export type EstadoFicha = "pendiente" | "en_proceso" | "atendida" | "rechazada";

export interface FichaAtencion {
  idFicha: number;
  solicitante: string;
  correo: string;
  motivo: string;
  detalle: string;
  estado: EstadoFicha;
  fechaSolicitud: string; // ISO date
  fechaAtencion: string | null;
  atendidoPor: string | null;
}
