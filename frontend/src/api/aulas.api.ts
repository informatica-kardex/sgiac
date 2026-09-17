import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Aula } from "./types";

export type CrearAulaPayload = Omit<Aula, "idAula">;
export type ActualizarAulaPayload = Partial<CrearAulaPayload>;

export const aulasApi = {
  listar: () => axiosClient.get<ApiEnvelope<Aula[]>>("/aulas"),
  obtener: (id: number) => axiosClient.get<ApiEnvelope<Aula>>(`/aulas/${id}`),
  crear: (payload: CrearAulaPayload) =>
    axiosClient.post<ApiEnvelope<Aula>>("/aulas", payload),
  actualizar: (id: number, payload: ActualizarAulaPayload) =>
    axiosClient.put<ApiEnvelope<Aula>>(`/aulas/${id}`, payload),
  eliminar: (id: number) => axiosClient.delete<ApiEnvelope<null>>(`/aulas/${id}`),
};
