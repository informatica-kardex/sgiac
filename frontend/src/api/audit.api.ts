import { axiosClient } from './axiosClient';
import type { ApiEnvelope } from './types';

export interface AuditEvent {
  idBitacora: string; fechaHora: string; accion: string; entidadAfectada: string;
  idRegistroAfectado: string | null; idUsuario: string | null;
  usuario: { idUsuario: string; nombreCompleto: string; correo: string } | null;
  tipo: string; resultado: string; detalle: unknown;
}
export interface AuditList {
  eventos: AuditEvent[]; total: number; pagina: number; limite: number; paginas: number;
  resumen: { exitosos: number; rechazados: number; errores: number };
}
export interface AuditFilters {
  acciones: string[]; entidades: string[];
  usuarios: { idUsuario: string; nombreCompleto: string; correo: string }[];
}
export type AuditParams = Record<string, string | number>;
export const auditApi = {
  list: async (params: AuditParams, signal: AbortSignal) =>
    (await axiosClient.get<ApiEnvelope<AuditList>>('/auditoria', { params, signal })).data.data,
  filters: async (signal: AbortSignal) =>
    (await axiosClient.get<ApiEnvelope<AuditFilters>>('/auditoria/filtros', { signal })).data.data,
  detail: async (id: string, signal: AbortSignal) =>
    (await axiosClient.get<ApiEnvelope<AuditEvent>>(`/auditoria/${id}`, { signal })).data.data,
  export: async (params: AuditParams) =>
    (await axiosClient.get<Blob>('/auditoria/exportar', { params, responseType: 'blob' })).data,
};
