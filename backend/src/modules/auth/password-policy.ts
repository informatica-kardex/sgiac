import { z } from "zod";

export const passwordSchema = z.string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede superar 72 caracteres")
  .regex(/\p{Lu}/u, "Incluye al menos una mayúscula")
  .regex(/\p{Ll}/u, "Incluye al menos una minúscula")
  .regex(/[0-9]/, "Incluye al menos un número")
  .regex(/[\p{P}\p{S}]/u, "Incluye al menos un carácter especial");
