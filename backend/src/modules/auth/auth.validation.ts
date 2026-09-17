import { z } from "zod";

export const registerSchema = z.object({
  nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120),
    apellidos: z.string().trim().min(1, "Ingresa tus apellidos").max(120),
    ci: z.string().trim().min(1, "Ingresa tu CI").max(30),
    ru: z.string().trim().min(1, "Ingresa tu registro universitario").max(30),
    carrera: z.string().trim().min(1, "Ingresa tu carrera").max(150),
    semestre: z.number({ invalid_type_error: "Ingresa un semestre válido" }).int().min(1).max(32767),
    gestion: z.number({ invalid_type_error: "Ingresa una gestión válida" }).int().min(1000).max(9999),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo institucional invalido").max(150),
  contrasena: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres")
    .max(72, "La contrasena es demasiado larga")
    .regex(/[A-Z]/, "Debe incluir al menos una letra mayuscula")
    .regex(/[a-z]/, "Debe incluir al menos una letra minuscula")
    .regex(/[0-9]/, "Debe incluir al menos un numero"),
  confirmarContrasena: z.string(),
}).refine((data) => `${data.nombres} ${data.apellidos}`.length <= 150, { message: "El nombre completo no puede superar 150 caracteres", path: ["apellidos"] }).refine((data) => data.contrasena === data.confirmarContrasena, {
  message: "Las contrasenas no coinciden",
  path: ["confirmarContrasena"],
});

export const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo invalido"),
  contrasena: z.string().min(1, "La contrasena es requerida"),
});

export const forgotPasswordSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo invalido"),
});

export const resetPasswordSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo invalido"),
  codigo: z.string().length(6, "El codigo debe tener 6 digitos"),
  nuevaContrasena: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una letra mayuscula")
    .regex(/[a-z]/, "Debe incluir al menos una letra minuscula")
    .regex(/[0-9]/, "Debe incluir al menos un numero"),
});

export const adminLoginSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo invalido"),
  contrasena: z.string().min(1, "La contrasena es requerida"),
});

export const changePasswordSchema = z.object({
  contrasenaActual: z.string().min(1, "La contrasena actual es requerida"),
  nuevaContrasena: z
    .string()
    .min(8, "La contrasena debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una letra mayuscula")
    .regex(/[a-z]/, "Debe incluir al menos una letra minuscula")
    .regex(/[0-9]/, "Debe incluir al menos un numero"),
  confirmarContrasena: z.string(),
}).refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
  message: "Las contrasenas no coinciden",
  path: ["confirmarContrasena"],
});

export const verifyEmailSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo invalido"),
  codigo: z.string().length(6, "El codigo debe tener 6 digitos"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
