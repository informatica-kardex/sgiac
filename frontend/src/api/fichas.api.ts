import { axiosClient } from "./axiosClient";
import { ApiEnvelope } from "./types";
import { FichaEstudiante, JornadaEstudiante } from "./estudiantes.api";

export interface Tramite { idTramite: string; nombre: string; descripcion: string; identificador: string | null }
export interface TramitePayload { nombre: string; descripcion: string; identificador: string }
export type JornadaPayload = Pick<JornadaEstudiante, "idTramite" | "identificador" | "fecha" | "horaInicio" | "horaFin" | "modoCupo" | "cupoTotal" | "minutosPorEstudiante" | "puesto" | "estado">;
export interface TurnoPublico extends JornadaEstudiante {
  actual: { codigo: string; numero: number; evento: string | null; llamadaEn: string | null } | null;
  siguientes: string[];
}
export interface LlamadoPublico {
  evento: string;
  codigo: string;
  numero: number;
  puesto: string;
  tramite: string;
  estado: string;
  llamadaEn: string;
}
export interface ConfigTV {
  voz: boolean;
  revision: string;
  pruebaVoz: string;
  archivos: { id: string; nombre: string; tipo: "imagen" | "video"; url: string }[];
}
export interface Tablero { fecha: string; actualizadoEn: string; jornadas: TurnoPublico[]; ultimosLlamados: LlamadoPublico[]; tv: ConfigTV }
export const fichasApi = {
  tvConfig: () => axiosClient.get<ApiEnvelope<ConfigTV>>("/fichas/tv/config"),
  tvVoz: (voz: boolean) => axiosClient.put<ApiEnvelope<ConfigTV>>("/fichas/tv/config", { voz }),
  tvActualizar: () => axiosClient.post("/fichas/tv/actualizar"),
  tvProbarVoz: () => axiosClient.post("/fichas/tv/probar-voz"),
  tvSubir: (archivo: File) => { const form = new FormData(); form.append("archivo", archivo); return axiosClient.post("/fichas/tv/archivos", form); },
  tvEliminar: (id: string) => axiosClient.delete(`/fichas/tv/archivos/${id}`),
  panel: (fecha: string) => axiosClient.get<ApiEnvelope<{ jornadas: JornadaEstudiante[]; fichas: FichaEstudiante[]; tramites: Tramite[] }>>("/fichas/panel", { params: { fecha } }),
  listar: (fecha: string) => axiosClient.get<ApiEnvelope<FichaEstudiante[]>>("/fichas", { params: { fecha } }),
  tramites: () => axiosClient.get<ApiEnvelope<Tramite[]>>("/fichas/tramites"),
  guardarTramite: (data: TramitePayload, id?: string) => id
    ? axiosClient.put(`/fichas/tramites/${id}`, data) : axiosClient.post("/fichas/tramites", data),
  borrarTramite: (id: string) => axiosClient.delete(`/fichas/tramites/${id}`),
  jornadas: (fecha: string) => axiosClient.get<ApiEnvelope<JornadaEstudiante[]>>("/fichas/jornadas", { params: { fecha } }),
  guardarJornada: (data: JornadaPayload, id?: string) => id
    ? axiosClient.put(`/fichas/jornadas/${id}`, data) : axiosClient.post("/fichas/jornadas", data),
  siguiente: (id: string) => axiosClient.post<ApiEnvelope<FichaEstudiante>>(`/fichas/jornadas/${id}/siguiente`),
  accion: (id: string, accion: "RELLAMAR" | "FINALIZAR" | "AUSENTE") => axiosClient.post(`/fichas/${id}/accion`, { accion }),
  tablero: () => axiosClient.get<ApiEnvelope<Tablero>>("/fichas/tablero", { timeout: 10000 }),
};
