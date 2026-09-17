import { z } from "zod";

export const crearFaqSchema = z.object({
  pregunta: z.string().trim().min(5).max(200),
  respuesta: z.string().trim().min(5),
  categoria: z.string().trim().min(2).max(60),
  estado: z.enum(["publicada", "borrador"]).default("publicada"),
});

export const actualizarFaqSchema = crearFaqSchema.partial();

export type CrearFaqInput = z.infer<typeof crearFaqSchema>;
export type ActualizarFaqInput = z.infer<typeof actualizarFaqSchema>;
