import { z } from "zod";

export const documentoId = z.string().regex(/^[1-9]\d{0,18}$/).refine(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const instante = z.string().datetime({ offset: true });
export const estadosDocumento = ["SOLICITADA", "EN_PREPARACION", "LISTA", "ENTREGADA", "RECHAZADA", "CANCELADA"] as const;
export const configuracionDocumentoSchema = z.object({
  nombre: z.string().trim().min(3).max(120), descripcion: z.string().trim().max(1000),
  identificador: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{0,19}$/, "El identificador debe comenzar con una letra y tener hasta 20 letras o números, sin espacios."),
  habilitado: z.boolean(), desde: instante.nullable(), hasta: instante.nullable(),
  plazoHoras: z.number().int().min(1).max(720),
  demoraRecojoMinutos: z.number().int().min(0).max(1440).default(60),
  cupoDiario: z.number().int().min(1).max(5000), lugar: z.string().trim().min(2).max(200),
  requisitos: z.string().trim().max(2000), correoHabilitado: z.boolean(),
  horaInicio: hora, horaFin: hora, diasAtencion: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    .refine(d => new Set(d).size === d.length, "No repitas días"),
  version: z.number().int().min(1).optional(),
}).refine(d => (!d.desde && !d.hasta) || !!d.desde && !!d.hasta && Date.parse(d.hasta) > Date.parse(d.desde),
  { message: "Indica ambas fechas y un cierre posterior al inicio", path: ["hasta"] })
  .refine(d => d.horaFin > d.horaInicio, { message: "El cierre debe ser posterior a la apertura", path: ["horaFin"] });
export const solicitarDocumentoSchema = z.object({
  idTipo: documentoId, motivo: z.string().trim().min(3).max(500), detalle: z.string().trim().max(2000).default(""),
});
export const accionDocumentoSchema = z.object({
  accion: z.enum(["PREPARAR", "LISTA", "ENTREGAR", "RECHAZAR", "ASIGNAR"]),
  version: z.number().int().min(1), observacion: z.string().trim().max(2000).default(""),
  fechaRecojo: instante.optional(), hojas: z.number().int().min(0).max(100).optional(),
  lugar: z.string().trim().min(2).max(200).optional(), requisitos: z.string().trim().max(2000).optional(),
  idResponsable: documentoId.nullable().optional(),
}).superRefine((d, ctx) => {
  if (d.accion === "LISTA" && (d.hojas === undefined || !d.lugar || d.requisitos === undefined))
    ctx.addIssue({ code: "custom", message: "Completa hojas, lugar e indicaciones de recojo" });
  if (d.accion === "RECHAZAR" && d.observacion.length < 5)
    ctx.addIssue({ code: "custom", path: ["observacion"], message: "Explica el motivo del rechazo" });
  if (d.accion === "ASIGNAR" && d.idResponsable === undefined)
    ctx.addIssue({ code: "custom", message: "Selecciona un responsable" });
});
export const filtroDocumentoSchema = z.object({
  estado: z.enum(estadosDocumento).optional(), q: z.string().trim().max(120).default(""),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
});
