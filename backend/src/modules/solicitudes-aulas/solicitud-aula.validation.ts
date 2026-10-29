import { z } from 'zod';
import { codigoSchema, idSchema } from '../academico/academico.shared';
import { diaDeFecha } from '../horarios/horario.fechas';

export const DIAS_SOLICITUD = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'] as const;
export const ACTIVIDADES = ['CLASE_TEORICA', 'PRACTICA_LABORATORIO'] as const;
const sesionSchema = z.object({
  dia: z.enum(DIAS_SOLICITUD), fecha: z.string().date().nullable(),
  horaInicio: z.string().regex(/^(0[7-9]|1\d|2[01]):[0-5]\d$/, 'El inicio debe estar entre 07:00 y 21:59'),
  horaFin: z.string().regex(/^(0[7-9]|1\d|2[01]):[0-5]\d$|^22:00$/, 'El final debe estar entre 07:00 y 22:00'),
}).strict().refine(s => s.horaInicio < s.horaFin, 'La hora final debe ser posterior al inicio');
export const agendaSchema = z.object({
  alcance: z.enum(['DIA', 'DOS_DIAS', 'SEMESTRE']), sesiones: z.array(sesionSchema).min(1).max(6),
}).strict().superRefine((p, ctx) => {
  if (p.alcance === 'DIA' && p.sesiones.length !== 1) ctx.addIssue({ code: 'custom', message: 'Para un día, indica una sola fecha y horario' });
  if (p.alcance === 'DOS_DIAS' && (p.sesiones.length !== 2 || new Set(p.sesiones.map(s => s.fecha)).size !== 2)) ctx.addIssue({ code: 'custom', message: 'Para dos días, indica dos fechas diferentes y sus horarios' });
  p.sesiones.forEach((s, i) => {
    if (p.alcance !== 'SEMESTRE' ? !s.fecha || diaDeFecha(s.fecha) !== s.dia : s.fecha !== null) ctx.addIssue({ code: 'custom', path: ['sesiones', i], message: 'La fecha y el día deben corresponder a la duración seleccionada' });
    if (p.sesiones.slice(0, i).some(t => t.dia === s.dia && t.fecha === s.fecha && t.horaInicio < s.horaFin && t.horaFin > s.horaInicio)) ctx.addIssue({ code: 'custom', path: ['sesiones', i], message: 'Los horarios de la solicitud se superponen' });
  });
});
export const reservaSchema = z.object({ aula: codigoSchema, agenda: agendaSchema }).strict();
export const disponibilidadSchema = z.object({ idAsignacion: idSchema, numeroEstudiantes: z.number().int().min(1).max(1000), actividad: z.enum(ACTIVIDADES), agenda: agendaSchema }).strict();
export const solicitarAulaSchema = z.object({
  idAsignacion: idSchema, celular: z.string().trim().regex(/^\+?[\d ()-]{7,30}$/, 'Ingresa un número de celular válido').refine(s => s.replace(/\D/g, '').length >= 7, 'Ingresa un número de celular válido'),
  numeroEstudiantes: z.number().int().min(1).max(1000), actividad: z.enum(ACTIVIDADES),
  detalle: z.string().trim().max(1000).default(''), reserva: reservaSchema,
}).strict();
export const versionSchema = z.object({ version: z.number().int().positive() }).strict();
export const responderAulaSchema = versionSchema.extend({ aceptar: z.boolean(), comentario: z.string().trim().max(1000).default('') });
export const revisarAulaSchema = versionSchema.extend({
  accion: z.enum(['APROBAR', 'PROPONER', 'RECHAZAR', 'CANCELAR']), propuesta: reservaSchema.optional(), comentario: z.string().trim().max(1000).default(''),
}).superRefine((p, ctx) => {
  if (p.accion === 'PROPONER' && !p.propuesta) ctx.addIssue({ code: 'custom', message: 'Selecciona un aula y horario alternativos' });
  if (p.accion !== 'APROBAR' && p.comentario.length < 5) ctx.addIssue({ code: 'custom', path: ['comentario'], message: 'Explica el motivo (al menos 5 caracteres)' });
  if (p.accion !== 'PROPONER' && p.propuesta) ctx.addIssue({ code: 'custom', message: 'Solo una propuesta puede cambiar el aula u horario' });
});
export type AgendaAula = z.infer<typeof agendaSchema>;
export type ReservaAula = z.infer<typeof reservaSchema>;
