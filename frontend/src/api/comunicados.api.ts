import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Comunicado } from "./types";

export type CrearComunicadoPayload = Pick<
  Comunicado,
  "titulo" | "resumen" | "contenido" | "categoria" | "estado"
>;
export type ActualizarComunicadoPayload = Partial<CrearComunicadoPayload>;

export const comunicadosApi = {
  listar: () => axiosClient.get<ApiEnvelope<Comunicado[]>>("/comunicados"),
  obtener: (id: number) =>
    axiosClient.get<ApiEnvelope<Comunicado>>(`/comunicados/${id}`),
  crear: (payload: CrearComunicadoPayload) =>
    axiosClient.post<ApiEnvelope<Comunicado>>("/comunicados", payload),
  actualizar: (id: number, payload: ActualizarComunicadoPayload) =>
    axiosClient.put<ApiEnvelope<Comunicado>>(`/comunicados/${id}`, payload),
  eliminar: (id: number) =>
    axiosClient.delete<ApiEnvelope<null>>(`/comunicados/${id}`),
  publicar: (id: number) =>
    axiosClient.patch<ApiEnvelope<Comunicado>>(`/comunicados/${id}/publicar`),
  archivar: (id: number) =>
    axiosClient.patch<ApiEnvelope<Comunicado>>(`/comunicados/${id}/archivar`),
};
