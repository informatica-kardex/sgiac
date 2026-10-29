import { z } from "zod";

export const idSchema = z.string().regex(/^[1-9]\d{0,18}$/).refine(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const date = new Date(`${v}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, "Fecha inválida");
const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const identificadorSchema = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{0,19}$/, "El identificador debe tener de 1 a 20 letras o números, comenzar con una letra y no incluir espacios ni símbolos.");
export const tramiteSchema = z.object({
  nombre: z.string().trim().min(3).max(150),
  descripcion: z.string().trim().max(500).default(""),
  identificador: identificadorSchema,
});
export const jornadaSchema = z.object({
  idTramite: idSchema.nullable(), fecha: fechaSchema,
  identificador: identificadorSchema.optional(),
  horaInicio: horaSchema, horaFin: horaSchema,
  modoCupo: z.enum(["MANUAL", "TIEMPO"]),
  cupoTotal: z.number().int().min(1).max(10000),
  minutosPorEstudiante: z.number().int().min(1).max(480),
  puesto: z.string().trim().min(2).max(80),
  estado: z.enum(["ACTIVO", "INACTIVO"]).default("ACTIVO"),
}).refine(v => v.horaFin > v.horaInicio, { message: "La hora final debe ser posterior a la inicial", path: ["horaFin"] });
export const solicitarFichaSchema = z.object({
  idJornada: idSchema,
  detalle: z.string().trim().max(2000).default(""),
});
export const accionFichaSchema = z.object({ accion: z.enum(["RELLAMAR", "FINALIZAR", "AUSENTE"]) });
export type JornadaInput = z.infer<typeof jornadaSchema>;
export type TramiteInput = z.infer<typeof tramiteSchema>;
