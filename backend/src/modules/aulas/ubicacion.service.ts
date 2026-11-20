import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { HorarioRepository } from '../horarios/horario.repository';
import { EstudianteService } from '../estudiantes/estudiante.service';

export const publicacionUbicacionInput = z.object({ publico: z.boolean(), estudiantes: z.boolean() }).strict();
const storedSchema = publicacionUbicacionInput.extend({ actualizadoEn: z.string().datetime().nullable() }).strict();
type Publication = z.infer<typeof storedSchema>;

// Same persistent-upload convention as the attention-screen settings. Reading
// never publishes implicitly. Atomic replacement preserves the last good file.
export function createLocationPublicationStore(directory: string) {
  let pending: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<Publication> => {
    try { return storedSchema.parse(JSON.parse(await readFile(path.join(directory,'publicacion.json'),'utf8'))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { publico:false, estudiantes:false, actualizadoEn:null };
      throw error;
    }
  };
  return {
    read,
    save(input: unknown): Promise<Publication> {
      const value = publicacionUbicacionInput.parse(input);
      const write = async () => {
        const config = { ...value, actualizadoEn: new Date().toISOString() };
        await mkdir(directory,{recursive:true});
        const temporary = path.join(directory,`${randomUUID()}.tmp`);
        try {
          await writeFile(temporary,JSON.stringify(config),{flag:'wx'});
          await rename(temporary,path.join(directory,'publicacion.json'));
        } finally { await unlink(temporary).catch(() => undefined); }
        return config;
      };
      const result = pending.then(write,write);
      pending = result.catch(() => undefined);
      return result;
    },
  };
}

export const locationPublication = createLocationPublicationStore(path.resolve(__dirname,'../../../uploads/ubicacion'));

// Explicit projection: published timetables never include internal reservation
// reasons, notices, contact details or administrative reallocation records.
export function publishedSchedule(h: Awaited<ReturnType<HorarioRepository['findAll']>>[number]) {
  return { idHorario:h.idHorario, idAsignacion:h.idAsignacion, idDocente:h.idDocente, idAuxiliar:h.idAuxiliar,
    esAuxiliar:h.esAuxiliar, esCoordinacion:h.esCoordinacion, responsable:h.responsable, fecha:h.fecha, motivo:'',
    idHorarioBase:h.idHorarioBase, aulaOriginal:h.aulaOriginal, traslados:h.traslados,
    codigoMateria:h.codigoMateria, siglas:h.siglas, materia:h.materia, docente:h.docente, aula:h.aula,
    dia:h.dia, horaInicio:h.horaInicio, horaFin:h.horaFin, grupo:h.grupo,
    idPeriodo:h.idPeriodo, periodo:h.periodo, lugar:h.lugar, piso:h.piso };
}

export async function publishedLocations(audience: 'publico' | 'estudiantes', userId?: string) {
  const config = await locationPublication.read();
  if (!config[audience]) return { publicado:false, aulas:[], periodos:[], horarios:[] };
  if (audience === 'estudiantes') {
    const data = await new EstudianteService().horariosAulas(userId!);
    const aulas = data.aulas.filter(a => a.lugar === 'INFORMATICA' && a.piso !== null && a.piso >= -1 && a.piso <= 6);
    const codes = new Set(aulas.map(a => a.codigo));
    return { publicado:true, aulas, periodos:data.periodos, horarios:data.horarios.filter(h => codes.has(h.aula)).map(publishedSchedule) };
  }
  // Public locations show only the floor plans. Timetables have their own publication.
  const rooms = await prisma.ambiente.findMany({ where:{lugar:'INFORMATICA',piso:{gte:-1,lte:6}}, select:{codigo_ambiente:true,nombre:true,lugar:true,piso:true,capacidad:true}, orderBy:[{piso:'asc'},{codigo_ambiente:'asc'}] });
  return { publicado:true,
    aulas:rooms.map(a => ({codigo:a.codigo_ambiente,nombre:a.nombre,lugar:a.lugar,piso:a.piso,capacidad:a.capacidad})),
    periodos:[], horarios:[],
  };
}
