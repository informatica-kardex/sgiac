import { axiosClient } from './axiosClient';
import { ApiEnvelope } from './types';
import { Asignacion } from './academico.api';

export const DIAS_AULA = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
export const ACTIVIDADES_AULA: Record<string, string> = { CLASE_TEORICA: 'Clase teórica', PRACTICA_LABORATORIO: 'Laboratorio' };
export const actividadAulaLabel = (actividad: string) => ACTIVIDADES_AULA[actividad] ?? ({ EXAMEN: 'Examen', TALLER_SEMINARIO: 'Taller / seminario', REUNION: 'Reunión', OTRO: 'Otra actividad' } as Record<string, string>)[actividad] ?? actividad;
export interface SesionAula { dia: typeof DIAS_AULA[number]; fecha: string | null; horaInicio: string; horaFin: string }
export interface AgendaAula { alcance: 'DIA' | 'DOS_DIAS' | 'SEMESTRE'; sesiones: SesionAula[] }
export interface ReservaAula { aula: string; agenda: AgendaAula }
export interface AsignacionAula extends Asignacion { desde: string; hasta: string }
export interface PerfilAuxiliarAulas {
  habilitado: boolean;
  datos: { nombre: string; ci: string; ru: string; correo: string; celular: string } | null;
  asignaciones: AsignacionAula[];
}
export interface AulaDisponible { codigo: string; nombre: string; lugar: string; piso: number | null; tipo: string; capacidad: number; disponible: boolean; motivo: string }
export interface SolicitudAula {
  id: string; codigo: string; estado: 'PENDIENTE' | 'PROPUESTA' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA'; version: number;
  nombre: string; ci: string; ru: string; correo: string; celular: string;
  numeroEstudiantes: number; actividad: string; detalle: string;
  reserva: ReservaAula; propuesta: ReservaAula | null; asignacion: AsignacionAula;
  creadaEn: string; actualizadaEn: string;
  historial: { fecha: string; autor: string; accion: string; comentario: string; reserva?: ReservaAula }[];
}
export interface SolicitarAulaInput { idAsignacion: string; celular: string; numeroEstudiantes: number; actividad: string; detalle: string; reserva: ReservaAula }
export type AccionRevisionAula = 'APROBAR' | 'PROPONER' | 'RECHAZAR' | 'CANCELAR';
const base = '/solicitudes-aulas';
const get = async <T,>(path: string) => (await axiosClient.get<ApiEnvelope<T>>(base + path)).data.data;
const post = async <T,>(path: string, body: unknown) => (await axiosClient.post<ApiEnvelope<T>>(base + path, body)).data.data;
export const solicitudesAulasApi = {
  perfil: () => get<PerfilAuxiliarAulas>('/perfil'),
  mias: () => get<SolicitudAula[]>('/mias'),
  bandeja: () => get<SolicitudAula[]>('/admin'),
  disponibilidad: (p: { idAsignacion: string; numeroEstudiantes: number; actividad: string; agenda: AgendaAula }) => post<AulaDisponible[]>('/disponibilidad', p),
  disponibilidadAdmin: (id: string, agenda: AgendaAula) => post<AulaDisponible[]>(`/admin/${id}/disponibilidad`, agenda),
  crear: (p: SolicitarAulaInput) => post<SolicitudAula>('', p),
  cancelar: (s: SolicitudAula) => post<SolicitudAula>(`/${s.id}/cancelar`, { version: s.version }),
  responder: (s: SolicitudAula, aceptar: boolean, comentario = '') => post<SolicitudAula>(`/${s.id}/responder`, { version: s.version, aceptar, comentario }),
  revisar: (s: SolicitudAula, accion: AccionRevisionAula, comentario: string, propuesta?: ReservaAula) => post<SolicitudAula>(`/admin/${s.id}/revisar`, { version: s.version, accion, comentario, ...(propuesta ? { propuesta } : {}) }),
};
