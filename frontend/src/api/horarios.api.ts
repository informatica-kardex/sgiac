import { axiosClient } from "./axiosClient";
import { ApiEnvelope, HorarioAcademico as Horario } from "./types";

export type CrearHorarioPayload = Pick<Horario, "idAsignacion" | "aula" | "dia" | "horaInicio" | "horaFin"> & Partial<Pick<Horario, 'idAuxiliar' | 'fecha' | 'motivo'>>;
export type ActualizarHorarioPayload = Partial<CrearHorarioPayload>;

export const horariosApi = {
  crearLote: (sesiones: CrearHorarioPayload[]) => axiosClient.post<ApiEnvelope<Horario[]>>('/horarios/lote', { sesiones }),
  listar: () => axiosClient.get<ApiEnvelope<Horario[]>>("/horarios"),
  obtener: (id: number) => axiosClient.get<ApiEnvelope<Horario>>(`/horarios/${id}`),
  crear: (payload: CrearHorarioPayload) =>
    axiosClient.post<ApiEnvelope<Horario>>("/horarios", payload),
  actualizar: (id: number, payload: ActualizarHorarioPayload) =>
    axiosClient.put<ApiEnvelope<Horario>>(`/horarios/${id}`, payload),
  eliminar: (id: number) => axiosClient.delete<ApiEnvelope<null>>(`/horarios/${id}`),
};
