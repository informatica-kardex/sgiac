import { z } from "zod";
import { FUNCIONES_SUBADMIN } from "../roles/permissions";

export const celularSchema = z.string().trim().min(1, "Ingresa tu número de celular").max(30)
  .regex(/^\+?[\d ()-]+$/, "Ingresa un número de celular válido")
  .transform(value => value.replace(/[ ()-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, "El celular debe tener entre 7 y 15 dígitos"));

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
  celular: celularSchema,
  nombreCompleto: z.string().trim().min(3).max(150),
  correo: z.string().trim().toLowerCase().email().max(150),
  ci: z.string().trim().min(1, "Ingresa el CI").max(30),
  permisos: permisosSchema,
}).strict();

export const resetearPasswordSchema = z.object({ ci: crearSubadminSchema.shape.ci.optional() });
export type CrearSubadminInput = z.infer<typeof crearSubadminSchema>;

export const crearEstudianteSchema = z.object({
  celular: celularSchema,
  nombres: z.string().trim().min(1).max(120),
  apellidos: z.string().trim().min(1).max(120),
  ci: z.string().trim().min(1).max(30),
  ru: z.string().trim().min(1).max(30),
  mencion: z.string().trim().min(1).max(150),
  correo: z.string().trim().toLowerCase().email().max(150)
    .regex(/@(fcpn\.edu\.bo|umsa\.bo)$/, 'Usa un correo institucional @fcpn.edu.bo o @umsa.bo'),
}).strict().refine(p => `${p.nombres} ${p.apellidos}`.length <= 150, 'El nombre completo no puede superar 150 caracteres');
export type CrearEstudianteInput = z.infer<typeof crearEstudianteSchema>;

// Solo datos personales; rechaza identificadores, roles y propiedades de seguridad.
export const perfilPersonalSchema = z.object({
  nombreCompleto: z.string().trim().min(3, "Ingresa tu nombre completo").max(150),
}).strict();
export const perfilEstudianteSchema = z.object({
  nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120),
  apellidos: z.string().trim().min(1, "Ingresa tus apellidos").max(120),
  ci: z.string().trim().min(1, "Ingresa tu CI").max(30),
  ru: z.string().trim().min(1, "Ingresa tu registro universitario").max(30),
  mencion: z.string().trim().min(1, "Ingresa tu mención").max(150),
}).strict().refine(p => `${p.nombres} ${p.apellidos}`.length <= 150, {
  message: "El nombre completo no puede superar 150 caracteres", path: ["apellidos"],
});
