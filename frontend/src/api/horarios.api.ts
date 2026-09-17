import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Horario } from "./types";

export type CrearHorarioPayload = Omit<Horario, "idHorario">;
export type ActualizarHorarioPayload = Partial<CrearHorarioPayload>;

export const horariosApi = {
  listar: () => axiosClient.get<ApiEnvelope<Horario[]>>("/horarios"),
  obtener: (id: number) => axiosClient.get<ApiEnvelope<Horario>>(`/horarios/${id}`),
  crear: (payload: CrearHorarioPayload) =>
    axiosClient.post<ApiEnvelope<Horario>>("/horarios", payload),
  actualizar: (id: number, payload: ActualizarHorarioPayload) =>
    axiosClient.put<ApiEnvelope<Horario>>(`/horarios/${id}`, payload),
  eliminar: (id: number) => axiosClient.delete<ApiEnvelope<null>>(`/horarios/${id}`),
};
