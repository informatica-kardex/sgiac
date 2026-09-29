import { z } from "zod";
import { passwordSchema } from "./password-policy";

const correoSchema = z.string().trim().toLowerCase().email("Correo inválido").max(150);
export const registerSchema = z.object({
  nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120),
  apellidos: z.string().trim().min(1, "Ingresa tus apellidos").max(120),
  ci: z.string().trim().min(1, "Ingresa tu CI").max(30),
  ru: z.string().trim().min(1, "Ingresa tu registro universitario").max(30),
  mencion: z.string().trim().min(1, "Ingresa tu mención").max(150),
  correo: correoSchema.regex(/@(fcpn\.edu\.bo|umsa\.bo)$/, "Usa un correo institucional @fcpn.edu.bo o @umsa.bo"),
  contrasena: passwordSchema,
  confirmarContrasena: z.string(),
}).refine(data => `${data.nombres} ${data.apellidos}`.length <= 150, {
  message: "El nombre completo no puede superar 150 caracteres", path: ["apellidos"],
}).refine(data => data.contrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden", path: ["confirmarContrasena"],
});

// El login acepta contraseñas anteriores y el CI temporal.
export const loginSchema = z.object({
  correo: correoSchema,
  contrasena: z.string().min(1, "La contraseña es requerida"),
  captchaId: z.string().regex(/^[a-f0-9]{64}$/, "Completa el CAPTCHA"),
  captchaCode: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/, "Ingresa las 6 letras y números del CAPTCHA"),
});
export const adminLoginSchema = loginSchema;
export const verifyLoginSchema = z.object({
  challengeId: z.string().regex(/^[a-f0-9]{64}$/),
  codigo: z.string().trim().regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
});
export const twoFactorSetupSchema = z.object({
  contrasena: z.string().min(1, "Ingresa tu contraseña actual"), enabled: z.boolean(),
});
export const confirmTwoFactorSchema = verifyLoginSchema.extend({ enabled: z.boolean() });
export const forgotPasswordSchema = z.object({ correo: correoSchema });
export const resendVerificationSchema = forgotPasswordSchema;
export const resetPasswordSchema = z.object({
  correo: correoSchema,
  codigo: z.string().trim().regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
  nuevaContrasena: passwordSchema,
});
export const changePasswordSchema = z.object({
  contrasenaActual: z.string().min(1, "La contraseña actual es requerida"),
  nuevaContrasena: passwordSchema,
  confirmarContrasena: z.string(),
}).refine(data => data.nuevaContrasena === data.confirmarContrasena, {
  message: "Las contraseñas no coinciden", path: ["confirmarContrasena"],
});
export const verifyEmailSchema = z.object({
  correo: correoSchema,
  codigo: z.string().trim().regex(/^\d{6}$/, "Ingresa el código de 6 dígitos"),
});
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
