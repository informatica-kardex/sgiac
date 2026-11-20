import { axiosClient } from "./axiosClient";
import { ApiEnvelope, HorarioAcademico as Horario } from "./types";
import type { HorariosAulasEstudiante } from './estudiantes.api';
import type { LocationPublication } from './ubicacion.api';

export const horariosPublicacionApi = {
  visibilidad: async () => (await axiosClient.get<ApiEnvelope<LocationPublication>>('/horarios/publicacion/visibilidad')).data.data,
  configuracion: async () => (await axiosClient.get<ApiEnvelope<LocationPublication>>('/horarios/publicacion/config')).data.data,
  publicar: async (config: Pick<LocationPublication, 'publico' | 'estudiantes'>) =>
    (await axiosClient.put<ApiEnvelope<LocationPublication>>('/horarios/publicacion/config', config)).data.data,
  consultar: async (student: boolean) =>
    (await axiosClient.get<ApiEnvelope<HorariosAulasEstudiante & { publicado: boolean }>>(student ? '/estudiantes/horarios-aulas' : '/horarios/publicacion/publico')).data.data,
};

export type CrearHorarioPayload = Pick<Horario, "idAsignacion" | "aula" | "dia" | "horaInicio" | "horaFin"> & Partial<Pick<Horario, 'idAuxiliar' | 'esAuxiliar' | 'fecha' | 'motivo'>> & { reubicaciones?: { idHorario: number; aula: string }[] };
export type ActualizarHorarioPayload = Partial<CrearHorarioPayload>;

export const horariosApi = {
  crearLote: (sesiones: CrearHorarioPayload[]) => axiosClient.post<ApiEnvelope<Horario[]>>('/horarios/lote', { sesiones }),
  listar: () => axiosClient.get<ApiEnvelope<Horario[]>>("/horarios"),
  obtener: (id: number) => axiosClient.get<ApiEnvelope<Horario>>(`/horarios/${id}`),
  crear: (payload: CrearHorarioPayload) =>
    axiosClient.post<ApiEnvelope<Horario>>("/horarios", payload),
  actualizar: (id: number, payload: ActualizarHorarioPayload) =>
    axiosClient.put<ApiEnvelope<Horario>>(`/horarios/${id}`, payload),
  eliminar: (id: number) => axiosClient.delete<ApiEnvelope<{ avisos: string[] }>>(`/horarios/${id}`),
};
