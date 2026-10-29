import { z } from 'zod';
import { codigoSchema, idSchema } from './academico.shared';
export const docenteSchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(150),
  gradoAcademico: z.string().trim().max(30).optional(),
  especialidad: z.string().trim().max(150).default(''),
  correo: z.union([z.string().trim().email().max(150), z.literal('')]).default(''),
  telefono: z.string().trim().max(30).default(''),
  estado: z.enum(['ACTIVO', 'INACTIVO']).default('ACTIVO'),
});
export const materiaSchema = z.object({
  codigo: codigoSchema,
  siglaPrincipal: codigoSchema.optional(),
  nombre: z.string().trim().min(3).max(150),
  siglas: z.array(codigoSchema).max(20).default([]),
  estado: z.enum(['ACTIVO', 'INACTIVO']).default('ACTIVO'),
});
export const asignacionSchema = z.object({
  idDocente: idSchema, codigoMateria: codigoSchema, idPeriodo: idSchema,
});
export const auxiliarSchema = z.object({ idEstudiante: idSchema, idAsignacion: idSchema }).strict();
export const vincularAuxiliarSchema = z.object({ idAsignacion: idSchema });
export const periodoSchema = z.object({
  gestion: z.number().int().min(2000).max(2100), periodo: z.enum(['I', 'II', 'ANUAL', 'VERANO']),
  fechaInicio: z.string().date(), fechaFin: z.string().date(),
}).refine(p => p.fechaInicio <= p.fechaFin, 'La fecha final debe ser posterior al inicio');
