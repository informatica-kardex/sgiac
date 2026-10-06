import { axiosClient } from "./axiosClient";
import { ApiEnvelope } from "./types";

export interface PerfilEstudiante {
  nombres: string;
  apellidos: string;
  ci: string;
  ru: string;
  correo: string;
  mencion: string | null;
}
export interface JornadaEstudiante {
  idJornada: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  disponibles: number;
  idTramite: string | null;
  tramite: string;
  cupoTotal: number;
  ocupadas: number;
  modoCupo: "MANUAL" | "TIEMPO";
  minutosPorEstudiante: number;
  puesto: string;
  estado: "ACTIVO" | "INACTIVO";
  enEspera: number;
  atendidas: number;
}
export interface FichaEstudiante {
  idFicha: string;
  numero: number;
  codigo: string;
  solicitante: string;
  correo: string;
  ru: string;
  delante: number;
  esperaMinutos: number;
  ultimoEvento: string | null;
  motivo: string;
  estado: string;
  fechaSolicitud: string;
  jornada: JornadaEstudiante;
}
export const estudiantesApi = {
  atencion: () => axiosClient.get<ApiEnvelope<{ fichas: FichaEstudiante[]; jornadas: JornadaEstudiante[] }>>("/estudiantes/atencion"),
  perfil: () => axiosClient.get<ApiEnvelope<PerfilEstudiante>>("/estudiantes/perfil"),
  jornadas: () => axiosClient.get<ApiEnvelope<JornadaEstudiante[]>>("/estudiantes/jornadas"),
  fichas: () => axiosClient.get<ApiEnvelope<FichaEstudiante[]>>("/estudiantes/fichas"),
  solicitar: (data: { idJornada: string; detalle?: string }) =>
    axiosClient.post<ApiEnvelope<FichaEstudiante>>("/estudiantes/fichas", data),
  cancelar: (id: string) => axiosClient.post(`/estudiantes/fichas/${id}/cancelar`),
};
