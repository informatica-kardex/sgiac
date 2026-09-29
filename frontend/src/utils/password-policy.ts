import { z } from "zod";

export function passwordRequirements(password: string) {
  return [
    { label: "8 caracteres como mínimo", met: password.length >= 8 },
    { label: "Una mayúscula", met: /\p{Lu}/u.test(password) },
    { label: "Una minúscula", met: /\p{Ll}/u.test(password) },
    { label: "Un número", met: /[0-9]/.test(password) },
    { label: "Un carácter especial", met: /[\p{P}\p{S}]/u.test(password) },
  ];
}

export const passwordSchema = z.string().max(72, "Máximo 72 caracteres")
  .superRefine((password, context) => {
    for (const requirement of passwordRequirements(password)) {
      if (!requirement.met) context.addIssue({ code: z.ZodIssueCode.custom, message: `Requiere: ${requirement.label.toLowerCase()}` });
    }
  });
