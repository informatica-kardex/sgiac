import { axiosClient } from './axiosClient';
import type { ApiEnvelope, DiaSemana } from './types';
export interface ImportGroup {
  key: string; pagina: number; materia: string; siglas: string[]; docente: string; paralelo: string;
  sesiones: { dia: DiaSemana; horaInicio: string; horaFin: string; aula: string }[];
}
export interface ImportInput { idPeriodo: string; grupos: ImportGroup[] }
export interface ImportSummary { grupos: number; sesiones: number; existentes: number; pendientes: number; materias: number; docentes: number; asignaciones: number }
export interface ImportPreview {
  huella: string; resumen: ImportSummary;
  grupos: (ImportGroup & { estado: 'LISTO' | 'EXISTENTE' | 'REVISAR'; errores: string[]; nuevaMateria: boolean; nuevoDocente: boolean;
    existentes: number; planes: { mencion: string; semestre: number | null; orden: number }[] })[];
}
export const horarioImportApi = {
  preview: async (input: ImportInput) => (await axiosClient.post<ApiEnvelope<ImportPreview>>('/horarios/importar-pdf/validar', input, { timeout: 60000 })).data.data,
  apply: async (datos: ImportInput, huella: string) => (await axiosClient.post<ApiEnvelope<ImportSummary>>('/horarios/importar-pdf/guardar', { datos, huella }, { timeout: 90000 })).data.data,
};
