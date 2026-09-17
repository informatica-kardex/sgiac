import { z } from "zod";

export const crearAulaSchema = z.object({
  codigo: z.string().trim().min(2).max(20),
  nombre: z.string().trim().min(3).max(100),
  capacidad: z.number().int().positive(),
  ubicacion: z.string().trim().min(3).max(150),
  estado: z.enum(["disponible", "mantenimiento", "inhabilitada"]).default("disponible"),
});

export const actualizarAulaSchema = crearAulaSchema.partial();

export type CrearAulaInput = z.infer<typeof crearAulaSchema>;
export type ActualizarAulaInput = z.infer<typeof actualizarAulaSchema>;
