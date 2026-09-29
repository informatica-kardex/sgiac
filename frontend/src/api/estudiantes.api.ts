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
}
export interface FichaEstudiante {
  idFicha: string;
  numero: number;
  motivo: string;
  estado: string;
  fechaSolicitud: string;
  jornada: JornadaEstudiante;
}
export const estudiantesApi = {
  perfil: () => axiosClient.get<ApiEnvelope<PerfilEstudiante>>("/estudiantes/perfil"),
  jornadas: () => axiosClient.get<ApiEnvelope<JornadaEstudiante[]>>("/estudiantes/jornadas"),
  fichas: () => axiosClient.get<ApiEnvelope<FichaEstudiante[]>>("/estudiantes/fichas"),
  solicitar: (data: { idJornada: string; motivo: string; detalle: string }) =>
    axiosClient.post<ApiEnvelope<FichaEstudiante>>("/estudiantes/fichas", data),
};
