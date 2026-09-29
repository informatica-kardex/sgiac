import { z } from "zod";
import { FUNCIONES_SUBADMIN } from "../roles/permissions";

export const idSchema = z.union([z.string().regex(/^[1-9]\d{0,18}$/), z.number().int().positive().safe()])
  .transform(value => BigInt(value)).refine(value => value <= 9223372036854775807n, "ID inválido");

const permisoSchema = z.object({
  modulo: z.enum(FUNCIONES_SUBADMIN),
  desde: z.string().datetime({ offset: true }).nullable().default(null),
  hasta: z.string().datetime({ offset: true }).nullable().default(null),
}).strict().refine(p => p.desde === null && p.hasta === null ||
  p.desde !== null && p.hasta !== null && Date.parse(p.hasta) > Date.parse(p.desde),
  "Indica inicio y fin; el fin debe ser posterior al inicio");
export const permisosSchema = z.array(permisoSchema).max(FUNCIONES_SUBADMIN.length)
  .refine(items => new Set(items.map(p => p.modulo)).size === items.length, "No repitas funciones");
export const asignarPermisosSchema = z.object({ permisos: permisosSchema }).strict();
export const crearSubadminSchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(150),
  correo: z.string().trim().toLowerCase().email().max(150),
  ci: z.string().trim().min(1, "Ingresa el CI").max(30),
  permisos: permisosSchema,
}).strict();

export const resetearPasswordSchema = z.object({ ci: crearSubadminSchema.shape.ci.optional() });
export type CrearSubadminInput = z.infer<typeof crearSubadminSchema>;
