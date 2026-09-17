import { axiosClient } from "./axiosClient";
import { ApiEnvelope, EstadoFicha, FichaAtencion } from "./types";

export interface CrearFichaPayload {
  solicitante: string;
  correo: string;
  motivo: string;
  detalle: string;
}

export interface ActualizarFichaPayload {
  estado?: EstadoFicha;
  atendidoPor?: string;
}

export const fichasApi = {
  listar: () => axiosClient.get<ApiEnvelope<FichaAtencion[]>>("/fichas"),
  obtener: (id: number) =>
    axiosClient.get<ApiEnvelope<FichaAtencion>>(`/fichas/${id}`),
  crear: (payload: CrearFichaPayload) =>
    axiosClient.post<ApiEnvelope<FichaAtencion>>("/fichas", payload),
  actualizar: (id: number, payload: ActualizarFichaPayload) =>
    axiosClient.patch<ApiEnvelope<FichaAtencion>>(`/fichas/${id}`, payload),
};
