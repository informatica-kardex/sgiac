import path from 'node:path';
import { prisma } from '../../database/prisma';
import { createLocationPublicationStore, publishedSchedule } from '../aulas/ubicacion.service';
import { EstudianteService } from '../estudiantes/estudiante.service';
import { HorarioRepository } from './horario.repository';

export const schedulePublication = createLocationPublicationStore(path.resolve(__dirname, '../../../uploads/horarios'));

export async function publishedSchedules(audience: 'publico' | 'estudiantes', userId?: string) {
  const config = await schedulePublication.read();
  if (!config[audience]) return { publicado: false, aulas: [], periodos: [], horarios: [] };
  if (audience === 'estudiantes') {
    const data = await new EstudianteService().horariosAulas(userId!);
    return { ...data, publicado: true, horarios: data.horarios.map(publishedSchedule) };
  }
  const [rooms, periods, schedules] = await Promise.all([
    prisma.ambiente.findMany({ select: { codigo_ambiente: true, nombre: true, lugar: true, piso: true, capacidad: true } }),
    prisma.periodo_academico.findMany({ where: { estado: 'ACTIVO' }, orderBy: [{ gestion: 'desc' }, { periodo: 'desc' }] }),
    new HorarioRepository().findAll(true),
  ]);
  const activePeriods = new Set(periods.map(p => String(p.id_periodo)));
  return {
    publicado: true,
    aulas: rooms.map(a => ({ codigo: a.codigo_ambiente, nombre: a.nombre, lugar: a.lugar, piso: a.piso, capacidad: a.capacidad })),
    periodos: periods.map(p => ({ idPeriodo: String(p.id_periodo), gestion: p.gestion, periodo: p.periodo, estado: p.estado,
      fechaInicio: p.fecha_inicio.toISOString().slice(0, 10), fechaFin: p.fecha_fin.toISOString().slice(0, 10) })),
    horarios: schedules.filter(h => activePeriods.has(h.idPeriodo)).map(publishedSchedule),
  };
}
