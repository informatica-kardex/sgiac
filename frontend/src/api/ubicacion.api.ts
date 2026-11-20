import { axiosClient } from './axiosClient';
import type { ApiEnvelope } from './types';
import type { HorariosAulasEstudiante } from './estudiantes.api';

export interface LocationPublication { publico: boolean; estudiantes: boolean; actualizadoEn: string | null }
export interface PublishedLocations extends HorariosAulasEstudiante { publicado: boolean }
export const ubicacionApi = {
  visibilidad: async () => (await axiosClient.get<ApiEnvelope<LocationPublication>>('/aulas/ubicacion/visibilidad')).data.data,
  configuracion: async () => (await axiosClient.get<ApiEnvelope<LocationPublication>>('/aulas/ubicacion/config')).data.data,
  publicar: async (config: Pick<LocationPublication,'publico' | 'estudiantes'>) => (await axiosClient.put<ApiEnvelope<LocationPublication>>('/aulas/ubicacion/config',config)).data.data,
  consultar: async (student: boolean) => (await axiosClient.get<ApiEnvelope<PublishedLocations>>(`/aulas/ubicacion/${student ? 'estudiantes' : 'publico'}`)).data.data,
};
