import { z } from 'zod';
import { codigoSchema, idSchema } from '../academico/academico.shared';
const fields = z.object({
  idAsignacion: idSchema, aula: codigoSchema,
  idAuxiliar: idSchema.nullable().optional().default(null),
  fecha: z.string().date().nullable().optional().default(null),
  motivo: z.string().trim().max(200).optional().default(''),
  dia: z.enum(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO']),
  horaInicio: z.string().regex(/^(0[7-9]|1\d|2[01]):[0-5]\d$/, 'El inicio debe estar entre 07:00 y 21:59'),
  horaFin: z.string().regex(/^(0[7-9]|1\d|2[01]):[0-5]\d$|^22:00$/, 'El final debe estar entre 07:00 y 22:00'),
});
export const crearHorarioSchema = fields.refine(p => p.horaInicio < p.horaFin, 'La hora final debe ser posterior al inicio');
export const actualizarHorarioSchema = fields.partial();
export const crearLoteHorarioSchema = z.object({ sesiones: z.array(crearHorarioSchema).min(1).max(24) });
export type CrearHorarioInput = z.input<typeof crearHorarioSchema>;
export type ActualizarHorarioInput = z.infer<typeof actualizarHorarioSchema>;
