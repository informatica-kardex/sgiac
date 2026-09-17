import { z } from "zod";

// ------------------ Autenticacion (portal publico) ------------------

export const loginSchema = z.object({
  correo: z.string().min(1, "El correo es requerido").email("Correo invalido"),
  contrasena: z.string().min(1, "La contrasena es requerida"),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    nombres: z.string().trim().min(1, "Ingresa tus nombres").max(120),
    apellidos: z.string().trim().min(1, "Ingresa tus apellidos").max(120),
    ci: z.string().trim().min(1, "Ingresa tu CI").max(30),
    ru: z.string().trim().min(1, "Ingresa tu registro universitario").max(30),
    carrera: z.string().trim().min(1, "Ingresa tu carrera").max(150),
    semestre: z.number({ invalid_type_error: "Ingresa un semestre válido" }).int().min(1).max(32767),
    gestion: z.number({ invalid_type_error: "Ingresa una gestión válida" }).int().min(1000).max(9999),
    correo: z.string().trim().toLowerCase().min(1, "El correo institucional es requerido").email("Correo invalido").max(150),
    contrasena: z
      .string()
      .min(8, "Minimo 8 caracteres").max(72)
      .regex(/[A-Z]/, "Debe incluir una mayuscula")
      .regex(/[a-z]/, "Debe incluir una minuscula")
      .regex(/[0-9]/, "Debe incluir un numero"),
    confirmarContrasena: z.string(),
  })
  .refine((data) => `${data.nombres} ${data.apellidos}`.length <= 150, { message: "El nombre completo no puede superar 150 caracteres", path: ["apellidos"] })
  .refine((data) => data.contrasena === data.confirmarContrasena, {
    message: "Las contrasenas no coinciden",
    path: ["confirmarContrasena"],
  });
export type RegisterFormData = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  correo: z.string().min(1, "El correo es requerido").email("Correo invalido"),
});
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    correo: z.string().email("Correo invalido"),
    codigo: z.string().length(6, "El codigo debe tener 6 digitos"),
    nuevaContrasena: z
      .string()
      .min(8, "Minimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir una mayuscula")
      .regex(/[a-z]/, "Debe incluir una minuscula")
      .regex(/[0-9]/, "Debe incluir un numero"),
    confirmarContrasena: z.string(),
  })
  .refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
    message: "Las contrasenas no coinciden",
    path: ["confirmarContrasena"],
  });
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  correo: z.string().email("Correo invalido"),
  codigo: z.string().length(6, "El codigo debe tener 6 digitos"),
});
export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

// ------------------ Panel administrativo ------------------

export const adminLoginSchema = z.object({
  correo: z.string().min(1, "El correo es requerido").email("Correo invalido"),
  contrasena: z.string().min(1, "La contrasena es requerida"),
});
export type AdminLoginFormData = z.infer<typeof adminLoginSchema>;

export const changePasswordSchema = z
  .object({
    contrasenaActual: z.string().min(1, "Ingresa tu contrasena actual"),
    nuevaContrasena: z
      .string()
      .min(8, "Minimo 8 caracteres")
      .regex(/[A-Z]/, "Debe incluir una mayuscula")
      .regex(/[a-z]/, "Debe incluir una minuscula")
      .regex(/[0-9]/, "Debe incluir un numero"),
    confirmarContrasena: z.string(),
  })
  .refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
    message: "Las contrasenas no coinciden",
    path: ["confirmarContrasena"],
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
  titulo: z.string().min(5).max(150),
  resumen: z.string().min(5).max(300),
  contenido: z.string().min(10),
  categoria: z.string().min(2).max(60),
  estado: z.enum(["publicado", "borrador", "archivado"]),
});
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
