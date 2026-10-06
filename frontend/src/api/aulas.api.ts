import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Aula } from "./types";

export type CrearAulaPayload = Omit<Aula, "idAula">;
export type ActualizarAulaPayload = Partial<CrearAulaPayload>;

export const aulasApi = {
  listar: () => axiosClient.get<ApiEnvelope<Aula[]>>("/aulas"),
  obtener: (id: string) => axiosClient.get<ApiEnvelope<Aula>>(`/aulas/${encodeURIComponent(id)}`),
  crear: (payload: CrearAulaPayload) =>
    axiosClient.post<ApiEnvelope<Aula>>("/aulas", payload),
  actualizar: (id: string, payload: ActualizarAulaPayload) =>
    axiosClient.put<ApiEnvelope<Aula>>(`/aulas/${encodeURIComponent(id)}`, payload),
  eliminar: (id: string) => axiosClient.delete<ApiEnvelope<null>>(`/aulas/${encodeURIComponent(id)}`),
};
