import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Comunicado } from "./types";

export type CrearComunicadoPayload = Pick<
  Comunicado,
  "titulo" | "tipo" | "contenido" | "categoria" | "estado"
>;
export type ActualizarComunicadoPayload = Partial<CrearComunicadoPayload> & { adjuntosEliminar?: string[] };

function formulario(payload: ActualizarComunicadoPayload, archivos?: File | File[] | null) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => { if (value !== undefined) form.append(key, Array.isArray(value) ? JSON.stringify(value) : value); });
  if (archivos) (Array.isArray(archivos) ? archivos : [archivos]).forEach(archivo => form.append("archivo", archivo));
  return form;
}

export function comunicadoArchivoUrl(url: string, publico = false, descargar = false) {
  const base = new URL(axiosClient.defaults.baseURL || "/api", window.location.origin);
  const result = new URL(url, base);
  if (publico) result.searchParams.set("publico", "1");
  if (descargar) result.searchParams.set("descargar", "1");
  return result.href;
}

export const comunicadosApi = {
  listar: (publico = false) => axiosClient.get<ApiEnvelope<Comunicado[]>>("/comunicados", { params: publico ? { publico: "1" } : {} }),
  obtener: (id: string, publico = false) =>
    axiosClient.get<ApiEnvelope<Comunicado>>(`/comunicados/${id}`, { params: publico ? { publico: "1" } : {} }),
  crear: (payload: CrearComunicadoPayload, archivo?: File | File[] | null) =>
    axiosClient.post<ApiEnvelope<Comunicado>>("/comunicados", formulario(payload, archivo)),
  actualizar: (id: string, payload: ActualizarComunicadoPayload, archivo?: File | File[] | null) =>
    axiosClient.put<ApiEnvelope<Comunicado>>(`/comunicados/${id}`, formulario(payload, archivo)),
  eliminar: (id: string) =>
    axiosClient.delete<ApiEnvelope<null>>(`/comunicados/${id}`),
  publicar: (id: string) =>
    axiosClient.patch<ApiEnvelope<Comunicado>>(`/comunicados/${id}/publicar`),
  archivar: (id: string) =>
    axiosClient.patch<ApiEnvelope<Comunicado>>(`/comunicados/${id}/archivar`),
};
