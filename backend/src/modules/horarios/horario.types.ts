export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO";

export interface Horario {
  idHorario: number;
  materia: string;
  docente: string;
  aula: string;
  dia: DiaSemana;
  horaInicio: string; // formato HH:mm
  horaFin: string; // formato HH:mm
  grupo: string;
}
