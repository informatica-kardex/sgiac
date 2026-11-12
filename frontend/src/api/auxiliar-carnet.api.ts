import axios from 'axios';
import { axiosClient } from './axiosClient';
import type { ApiEnvelope } from './types';
import type { PerfilAuxiliarAulas } from './solicitudes-aulas.api';

export interface CarnetAuxiliar {
  idAuxiliar: string;
  nombreCompleto: string;
  ru: string;
  correo: string;
  materias: string[];
  token: string;
}
export interface HorarioCarnet {
  aulaOriginal?: string | null; docenteReserva?: string | null; traslados?: { fecha: string; aula: string }[];
  id: string; idAsignacion: string; aula: string; dia: string; fecha: string | null;
  horaInicio: string; horaFin: string; lugar: string; piso: number | null;
  materia: string; grupo: string; periodo: string; desde: string; hasta: string;
}
export interface ConsultaCarnet {
  nombreCompleto: string;
  horarios: HorarioCarnet[];
  consultadoEn: string;
}

// Comparte la dirección de la API, sin interceptores ni requisito de sesión.
const publico = axios.create({ baseURL: axiosClient.defaults.baseURL, timeout: 15000 });
export const auxiliarCarnetApi = {
  miAuxiliatura: async () => (await axiosClient.get<ApiEnvelope<{ perfil: PerfilAuxiliarAulas; horarios: HorarioCarnet[] }>>('/estudiantes/auxiliatura')).data.data,
  miCarnet: async () => (await axiosClient.get<ApiEnvelope<CarnetAuxiliar>>('/estudiantes/auxiliatura/carnet')).data.data,
  emitir: async (id: string) => (await axiosClient.get<ApiEnvelope<CarnetAuxiliar>>(`/academico/auxiliares/${encodeURIComponent(id)}/carnet`)).data.data,
  consultar: async (token: string) => (await publico.get<ApiEnvelope<ConsultaCarnet>>(`/academico/auxiliares/carnet/${encodeURIComponent(token)}`)).data.data,
};

export function enlaceCarnet(token: string) {
  const base = new URL(import.meta.env.VITE_PUBLIC_SITE_URL || window.location.origin);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('Configura VITE_PUBLIC_SITE_URL con el origen público del sitio, por ejemplo https://sgiac.umsa.bo.');
  }
  return new URL(`/auxiliares/carnet/${encodeURIComponent(token)}`, base).href;
}
