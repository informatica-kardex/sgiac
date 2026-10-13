import { axiosClient } from './axiosClient';
import { ApiEnvelope, Aula, HorarioAcademico } from './types';
export const LUGARES: Record<string, string> = { ANTIGUO: 'Edificio antiguo', PABELLONES: 'Pabellones', LASIN: 'LASIN', INFORMATICA: 'Edificio de Informática' };
export const pisoLabel = (piso: number | null) => piso === null ? 'Sin piso / por confirmar' : piso === -1 ? 'Subsuelo' : piso === 0 ? 'Planta baja' : `Piso ${piso}`;
export interface Asignacion { idAsignacion: string; idDocente: string; codigoMateria: string; siglas: string[]; materia: string; docente: string; grupo: string; idPeriodo: string; periodo: string; estado: string }
export interface Docente { idDocente: string; nombreCompleto: string; gradoAcademico: string; nombreConGrado?: string; especialidad: string; correo: string; telefono: string; estado: string; asignaciones: Asignacion[] }
export const GRADOS_DOCENTES = ['Lic.', 'M.Sc.', 'Ph.D.', 'Ing.', 'M.Eng.', 'MBA', 'Dr.', 'Dra.'];
export function docenteLabel(d: Pick<Docente, 'nombreCompleto'> & Partial<Pick<Docente, 'gradoAcademico' | 'nombreConGrado'>>) {
  if (d.nombreConGrado) return d.nombreConGrado;
  const nombre = d.nombreCompleto.trim(), grado = d.gradoAcademico?.trim();
  const normal = (s: string) => s.toLowerCase().replace(/[.\s]/g, '');
  return !grado || normal(nombre.split(/\s+/)[0]) === normal(grado) ? nombre : `${grado} ${nombre}`;
}
export interface Auxiliar { idAuxiliar: string; nombreCompleto: string; correo: string; telefono: string; estado: string; asignaciones: Asignacion[] }
export type AuxiliarInput = Omit<Auxiliar, 'idAuxiliar' | 'asignaciones'>;
export interface Mencion { id: string; nombre: string }
export interface MateriaPlan { mencion: string; semestre: number | null; orden: number }
export interface Materia { codigo: string; siglaPrincipal?: string; nombre: string; siglas: string[]; estado: string; planes?: MateriaPlan[]; semestrePromedio?: number | null; ordenPromedio?: number | null }
export interface Periodo { idPeriodo: string; gestion: number; periodo: string; fechaInicio: string; fechaFin: string; estado: string }
export type DocenteInput = Omit<Docente, 'idDocente' | 'asignaciones' | 'nombreConGrado'>;
export type AsignacionInput = Pick<Asignacion, 'idDocente' | 'codigoMateria' | 'idPeriodo'>;
const get = async <T,>(ruta: string) => (await axiosClient.get<ApiEnvelope<T>>(`/academico/${ruta}`)).data.data;
export const academicoApi = {
  menciones: () => get<Mencion[]>('menciones'),
  auxiliares: () => get<Auxiliar[]>('auxiliares'), horarios: () => get<HorarioAcademico[]>('horarios'),
  guardarAuxiliar: (p: AuxiliarInput, id?: string) => id ? axiosClient.put(`/academico/auxiliares/${id}`, p) : axiosClient.post('/academico/auxiliares', p),
  vincularAuxiliar: (id: string, idAsignacion: string) => axiosClient.post(`/academico/auxiliares/${id}/asignaciones`, { idAsignacion }),
  desvincularAuxiliar: (id: string, idAsignacion: string) => axiosClient.delete(`/academico/auxiliares/${id}/asignaciones/${idAsignacion}`),
  docentes: () => get<Docente[]>('docentes'), materias: () => get<Materia[]>('materias'), periodos: () => get<Periodo[]>('periodos'),
  horariosDocente: (id: string) => get<(HorarioAcademico & { estado: string })[]>(`docentes/${encodeURIComponent(id)}/horarios`),
  asignaciones: () => get<Asignacion[]>('asignaciones'), aulas: () => get<Aula[]>('aulas'),
  guardarDocente: (p: DocenteInput, id?: string) => id ? axiosClient.put(`/academico/docentes/${id}`, p) : axiosClient.post('/academico/docentes', p),
  guardarMateria: (p: Materia, codigo?: string) => codigo ? axiosClient.put(`/academico/materias/${encodeURIComponent(codigo)}`, p) : axiosClient.post('/academico/materias', p),
  asignar: (p: AsignacionInput) => axiosClient.post('/academico/asignaciones', p),
  quitarAsignacion: (id: string) => axiosClient.delete(`/academico/asignaciones/${id}`),
  crearPeriodo: (p: Omit<Periodo, 'idPeriodo' | 'estado'>) => axiosClient.post('/academico/periodos', p),
};
