export type EstadoAula = "disponible" | "mantenimiento" | "inhabilitada";

export interface Aula {
  idAula: number;
  codigo: string;
  nombre: string;
  capacidad: number;
  ubicacion: string;
  estado: EstadoAula;
}
