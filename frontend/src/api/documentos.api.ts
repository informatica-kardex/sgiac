import { axiosClient } from "./axiosClient";
import { ApiEnvelope } from "./types";

export const ESTADOS_DOCUMENTO = { SOLICITADA: "Solicitada", EN_PREPARACION: "En preparación", LISTA: "Lista para recoger", ENTREGADA: "Entregada", RECHAZADA: "Rechazada", CANCELADA: "Cancelada" } as const;
export type EstadoDocumento = keyof typeof ESTADOS_DOCUMENTO;
export interface TipoDocumento {
  id: string; nombre: string; identificador: string; descripcion: string; habilitado: boolean; disponible: boolean;
  desde: string | null; hasta: string | null; plazoHoras: number; cupoDiario: number;
  lugar: string; requisitos: string; correoHabilitado: boolean; horaInicio: string; horaFin: string;
  diasAtencion: number[]; version: number;
  demoraRecojoMinutos: number;
}
export interface SolicitudDocumento {
  id: string; codigo: string; idTipo: string; documento: string; solicitante: string; ru: string; ci: string;
  nombres: string; apellidos: string;
  motivo: string; detalle: string; estado: EstadoDocumento; creadaEn: string; estimadaEn: string;
  fechaRecojo: string | null; hojas: number | null; lugar: string; requisitos: string; version: number;
  correoHabilitado: boolean; responsable: { id: string; nombre: string } | null;
  correo: { estado: "PENDIENTE" | "ENVIADO" | "ERROR" | "OMITIDO"; intentos: number; enviadoEn: string | null } | null;
  telegram: SolicitudDocumento["correo"];
  eventos: { id: string; estado: EstadoDocumento; descripcion: string; fecha: string }[];
}
export interface BandejaDocumentos { solicitudes: SolicitudDocumento[]; total: number; pagina: number; resumen: Partial<Record<EstadoDocumento, number>> }
export type ConfigDocumento = Omit<TipoDocumento, "id" | "disponible" | "version"> & { version?: number };
export interface AccionDocumento {
  accion: "PREPARAR" | "LISTA" | "ENTREGAR" | "RECHAZAR" | "ASIGNAR"; version: number;
  observacion?: string; fechaRecojo?: string; hojas?: number; lugar?: string; requisitos?: string; idResponsable?: string | null;
}
export const documentosApi = {
  portal: () => axiosClient.get<ApiEnvelope<{ tipos: TipoDocumento[]; solicitudes: SolicitudDocumento[] }>>("/documentos/mis-solicitudes"),
  solicitar: (data: { idTipo: string; motivo: string; detalle: string }) => axiosClient.post<ApiEnvelope<SolicitudDocumento>>("/documentos/mis-solicitudes", data),
  cancelar: (id: string) => axiosClient.post(`/documentos/mis-solicitudes/${id}/cancelar`),
  bandeja: (params: { estado?: string; q?: string; pagina: number }) => axiosClient.get<ApiEnvelope<BandejaDocumentos>>("/documentos/bandeja", { params }),
  tipos: () => axiosClient.get<ApiEnvelope<TipoDocumento[]>>("/documentos/tipos"),
  responsables: () => axiosClient.get<ApiEnvelope<{ id: string; nombre: string }[]>>("/documentos/responsables"),
  guardarTipo: (id: string | null, data: ConfigDocumento) => id ? axiosClient.put(`/documentos/tipos/${id}`, data) : axiosClient.post("/documentos/tipos", data),
  accion: (id: string, data: AccionDocumento) => axiosClient.post<ApiEnvelope<SolicitudDocumento>>(`/documentos/${id}/accion`, data),
  reintentar: (id: string, canal: "CORREO" | "TELEGRAM" = "CORREO") => axiosClient.post(`/documentos/${id}/reintentar-correo`, { canal }),
};
