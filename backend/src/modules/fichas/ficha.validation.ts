import { z } from "zod";

export const crearFichaSchema = z.object({
  solicitante: z.string().trim().min(3).max(150),
  correo: z.string().trim().email(),
  motivo: z.string().trim().min(3).max(150),
  detalle: z.string().trim().min(5),
});

export const actualizarFichaSchema = z.object({
  estado: z.enum(["pendiente", "en_proceso", "atendida", "rechazada"]).optional(),
  atendidoPor: z.string().trim().min(2).max(150).optional(),
});

export type CrearFichaInput = z.infer<typeof crearFichaSchema>;
export type ActualizarFichaInput = z.infer<typeof actualizarFichaSchema>;
