import { z } from "zod";

export const crearComunicadoSchema = z.object({
  titulo: z.string().trim().min(5).max(150),
  contenido: z.string().trim().max(50000).default(""),
  tipo: z.enum(["texto", "imagen", "pdf"]).default("texto"),
  categoria: z.string().trim().min(2).max(60),
  estado: z.enum(["publicado", "borrador", "archivado"]).default("borrador"),
});

const adjuntosEliminarSchema = z.preprocess(value => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.array(z.string().regex(/^[1-9]\d*$/, "Identificador de imagen inválido")).max(10)
  .refine(ids => new Set(ids).size === ids.length, "No repitas los archivos a retirar"));

export const actualizarComunicadoSchema = crearComunicadoSchema.partial().extend({
  adjuntosEliminar: adjuntosEliminarSchema.optional(),
});

export type CrearComunicadoInput = z.infer<typeof crearComunicadoSchema>;
export type ActualizarComunicadoInput = z.infer<typeof actualizarComunicadoSchema>;
