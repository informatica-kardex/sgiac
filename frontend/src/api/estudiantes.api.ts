import { axiosClient } from "./axiosClient";
import { ApiEnvelope, Aula, HorarioAcademico } from "./types";
import type { Periodo } from './academico.api';

export interface HorariosAulasEstudiante {
  aulas: Pick<Aula, 'codigo' | 'nombre' | 'lugar' | 'piso'>[];
  periodos: Periodo[];
  horarios: HorarioAcademico[];
}

export interface PerfilEstudiante {
  nombres: string;
  apellidos: string;
  ci: string;
  ru: string;
  correo: string;
  mencion: string | null;
}
export interface CatalogoHorario {
  menciones: { id: string; nombre: string }[];
  materias: { nombre: string; siglas: string[]; planes: { mencion: string; semestre: number | null; orden: number }[] }[];
  periodos: { id: string; nombre: string; desde: string; hasta: string }[];
}
export interface PuestoAtencion { idPuesto: string; nombre: string }
export interface JornadaEstudiante {
  idJornada: string;
  identificador: string;
  emitidas: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  disponibles: number;
  idTramite: string | null;
  tramite: string;
  cupoTotal: number;
  ocupadas: number;
  modoCupo: "MANUAL" | "TIEMPO";
  minutosPorEstudiante: number;
  puesto: string;
  puestos: PuestoAtencion[];
  idPuestos: string[];
  estado: "ACTIVO" | "INACTIVO";
  enEspera: number;
  atendidas: number;
}
export interface FichaEstudiante {
  idPuesto: string | null;
  puesto: string | null;
  idFicha: string;
  numero: number;
  codigo: string;
  solicitante: string;
  correo: string;
  ru: string;
  delante: number;
  esperaMinutos: number;
  ultimoEvento: string | null;
  motivo: string;
  estado: string;
  fechaSolicitud: string;
  jornada: JornadaEstudiante;
}
export const estudiantesApi = {
  horariosAulas: () => axiosClient.get<ApiEnvelope<HorariosAulasEstudiante>>('/estudiantes/horarios-aulas'),
  catalogoHorario: () => axiosClient.get<ApiEnvelope<CatalogoHorario>>("/estudiantes/catalogo-horario"),
  atencion: () => axiosClient.get<ApiEnvelope<{ fichas: FichaEstudiante[]; jornadas: JornadaEstudiante[] }>>("/estudiantes/atencion"),
  perfil: () => axiosClient.get<ApiEnvelope<PerfilEstudiante>>("/estudiantes/perfil"),
  jornadas: () => axiosClient.get<ApiEnvelope<JornadaEstudiante[]>>("/estudiantes/jornadas"),
  fichas: () => axiosClient.get<ApiEnvelope<FichaEstudiante[]>>("/estudiantes/fichas"),
  solicitar: (data: { idJornada: string; detalle?: string }) =>
    axiosClient.post<ApiEnvelope<FichaEstudiante>>("/estudiantes/fichas", data),
  cancelar: (id: string) => axiosClient.post(`/estudiantes/fichas/${id}/cancelar`),
};
