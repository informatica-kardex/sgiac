import { z } from "zod";

export const crearHorarioSchema = z.object({
  materia: z.string().trim().min(2).max(120),
  docente: z.string().trim().min(2).max(120),
  aula: z.string().trim().min(2).max(30),
  dia: z.enum(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora invalido (HH:mm)"),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora invalido (HH:mm)"),
  grupo: z.string().trim().min(1).max(10),
});

export const actualizarHorarioSchema = crearHorarioSchema.partial();

export type CrearHorarioInput = z.infer<typeof crearHorarioSchema>;
export type ActualizarHorarioInput = z.infer<typeof actualizarHorarioSchema>;
