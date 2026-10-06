import { z } from "zod";
import { codigoSchema, LUGARES } from '../academico/academico.shared';

export const nombreEquipoNormalizado = (nombre: string) => nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
export const equipamientoAulaSchema = z.array(z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del equipo').max(120).transform(s => s.replace(/\s+/g, ' ')),
  cantidad: z.number().int().min(1, 'La cantidad debe ser mayor a cero').max(10000),
})).max(100).refine(equipos => new Set(equipos.map(e => nombreEquipoNormalizado(e.nombre))).size === equipos.length,
  'No repitas un equipo: modifica su cantidad');

export const crearAulaSchema = z.object({
  codigo: codigoSchema,
  lugar: z.enum(LUGARES),
  piso: z.number().int().min(-2).max(30).nullable().default(null),
  tipo: z.enum(['AULA', 'LABORATORIO']).default('AULA'),
  nombre: z.string().trim().min(3).max(100),
  capacidad: z.number().int().min(0).max(2000),
  ubicacion: z.string().trim().max(200).default(''),
  equipamiento: equipamientoAulaSchema.optional(),
  estado: z.enum(["disponible", "mantenimiento", "inhabilitada"]).default("disponible"),
});

export const actualizarAulaSchema = crearAulaSchema.partial();

export type CrearAulaInput = z.infer<typeof crearAulaSchema>;
export type ActualizarAulaInput = z.infer<typeof actualizarAulaSchema>;
