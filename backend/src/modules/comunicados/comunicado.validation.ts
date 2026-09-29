import { z } from "zod";

export const crearComunicadoSchema = z.object({
  titulo: z.string().trim().min(5).max(150),
  contenido: z.string().trim().max(50000).default(""),
  tipo: z.enum(["texto", "imagen", "pdf"]).default("texto"),
  categoria: z.string().trim().min(2).max(60),
  estado: z.enum(["publicado", "borrador", "archivado"]).default("borrador"),
});

export const actualizarComunicadoSchema = crearComunicadoSchema.partial();

export type CrearComunicadoInput = z.infer<typeof crearComunicadoSchema>;
export type ActualizarComunicadoInput = z.infer<typeof actualizarComunicadoSchema>;
