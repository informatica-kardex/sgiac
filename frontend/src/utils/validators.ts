import { z } from "zod";
import { passwordSchema } from "./password-policy";

export const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().min(1, "El correo es requerido").email("Correo inválido"),
  contrasena: z.string().min(1, "La contraseña es requerida"),
});
export type LoginFormData = z.infer<typeof loginSchema>;
export const adminLoginSchema = loginSchema;
export type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

export const registerSchema = z.object({
  nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120),
  apellidos: z.string().trim().min(1, "Ingresa tus apellidos").max(120),
  ci: z.string().trim().min(1, "Ingresa tu CI").max(30),
  ru: z.string().trim().min(1, "Ingresa tu registro universitario").max(30),
  mencion: z.string().trim().min(1, "Selecciona tu mención").max(150),
  correo: z.string().trim().toLowerCase().email("Correo inválido").max(150)
    .regex(/@(fcpn\.edu\.bo|umsa\.bo)$/, "Usa un correo institucional @fcpn.edu.bo o @umsa.bo"),
  contrasena: passwordSchema,
  confirmarContrasena: z.string(),
}).refine(data => `${data.nombres} ${data.apellidos}`.length <= 150, {
  message: "El nombre completo no puede superar 150 caracteres", path: ["apellidos"],
}).refine(data => data.contrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden", path: ["confirmarContrasena"],
});
export type RegisterFormData = z.infer<typeof registerSchema>;
export const forgotPasswordSchema = z.object({ correo: z.string().trim().toLowerCase().email("Correo inválido") });
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export const resetPasswordSchema = z.object({
  correo: z.string().email("Correo inválido"),
  codigo: z.string().trim().regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
  nuevaContrasena: passwordSchema,
  confirmarContrasena: z.string(),
}).refine(data => data.nuevaContrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden", path: ["confirmarContrasena"],
});
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export const verifyEmailSchema = z.object({
  correo: z.string().email("Correo inválido"),
  codigo: z.string().trim().regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
});
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;
export const changePasswordSchema = z.object({
  contrasenaActual: z.string().min(1, "Ingresa tu contraseña actual"),
  nuevaContrasena: passwordSchema,
  confirmarContrasena: z.string(),
}).refine(data => data.nuevaContrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden", path: ["confirmarContrasena"],
});
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

export const aulaSchema = z.object({
  codigo: z.string().min(2, "Minimo 2 caracteres").max(20),
  nombre: z.string().min(3, "Minimo 3 caracteres").max(100),
  capacidad: z.coerce.number().int().positive("Debe ser mayor a 0"),
  ubicacion: z.string().min(3, "Minimo 3 caracteres").max(150),
  estado: z.enum(["disponible", "mantenimiento", "inhabilitada"]),
});
export type AulaFormData = z.infer<typeof aulaSchema>;

export const horarioSchema = z.object({
  materia: z.string().min(2).max(120),
  docente: z.string().min(2).max(120),
  aula: z.string().min(2).max(30),
  dia: z.enum(["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"]),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm"),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm"),
  grupo: z.string().min(1).max(10),
});
export type HorarioFormData = z.infer<typeof horarioSchema>;

export const comunicadoSchema = z.object({
  titulo: z.string().trim().min(5).max(150),
  tipo: z.enum(["texto", "imagen", "pdf"]),
  contenido: z.string().trim().max(50000),
  categoria: z.string().trim().min(2).max(60),
  estado: z.enum(["publicado", "borrador", "archivado"]),
}).refine(data => data.tipo !== "texto" || data.contenido.length > 0, { message: "Escribe el texto del comunicado", path: ["contenido"] });
export type ComunicadoFormData = z.infer<typeof comunicadoSchema>;

export const faqSchema = z.object({
  pregunta: z.string().min(5).max(200),
  respuesta: z.string().min(5),
  categoria: z.string().min(2).max(60),
  estado: z.enum(["publicada", "borrador"]),
});
export type FaqFormData = z.infer<typeof faqSchema>;

export const fichaPublicaSchema = z.object({
  solicitante: z.string().min(3, "Ingresa tu nombre completo").max(150),
  correo: z.string().email("Correo invalido"),
  motivo: z.string().min(3, "Indica el motivo").max(150),
  detalle: z.string().min(5, "Describe tu solicitud con mas detalle"),
});
export type FichaPublicaFormData = z.infer<typeof fichaPublicaSchema>;

