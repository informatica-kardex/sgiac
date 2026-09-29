import crypto from "crypto";
import { ApiError } from "../../utils/apiError";
import { sendMail } from "../../utils/mail";
import { academicCodeMail } from "../../utils/mail-template";

const CAPTCHA_TTL = 5 * 60_000;
const CODE_TTL = 5 * 60_000;
const MAX_CHALLENGES = 10_000;
const secret = crypto.randomBytes(32);

interface CaptchaEntry { digest: Buffer; expiresAt: number }
interface LoginEntry extends CaptchaEntry {
  idUsuario: string;
  correo: string;
  passwordHash: string;
  admin: boolean;
  purpose: "login" | "enable" | "disable";
  attempts: number;
  createdAt: number;
  ready: boolean;
}

// Retos efimeros para una instancia del backend; nunca son tokens de sesion.
const captchas = new Map<string, CaptchaEntry>();
const logins = new Map<string, LoginEntry>();

function digest(value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest();
}

function makeRoom<T extends CaptchaEntry>(entries: Map<string, T>) {
  for (const [id, entry] of entries) {
    if (entry.expiresAt <= Date.now()) entries.delete(id);
  }
  if (entries.size >= MAX_CHALLENGES) {
    throw new ApiError(429, "Demasiadas solicitudes. Intenta nuevamente mas tarde.");
  }
}

// Glifos dibujados como trazos: el SVG no contiene la respuesta como texto.
const digits = [
  "M3 0H17V28H3ZM3 0L17 28", "M5 6L11 0V28M4 28H18",
  "M3 4Q10 -4 17 4V10L3 28H18", "M3 2H17L9 13Q22 12 17 25Q10 31 3 25",
  "M14 28V0L2 19H20", "M18 0H3V13Q21 7 18 24Q12 32 3 26",
  "M17 1Q1 -4 3 22Q5 33 16 26Q24 11 3 13", "M2 0H19L7 28",
  "M10 13C-6 10 3 -8 17 2C25 12 10 13 10 13C-7 16 2 34 17 26C27 15 10 13 10 13",
  "M17 15Q-3 20 3 3Q17 -7 18 9V20Q17 32 4 27",
];

const letters: Record<string, string> = {
  A: "M1 28L10 0L19 28M5 18H15", B: "M2 28V0H10Q25 6 10 13H2M10 13Q27 21 10 28H2",
  C: "M19 3Q1 -8 2 14Q1 36 19 25", D: "M2 0V28H8Q28 14 8 0Z",
  E: "M19 0H2V28H19M2 14H16", F: "M19 0H2V28M2 13H16",
  G: "M19 3Q1 -7 2 14Q1 35 19 25V15H11", H: "M2 0V28M18 0V28M2 14H18",
  J: "M5 0H18V22Q16 34 2 24", K: "M2 0V28M19 0L2 15L19 28",
  L: "M2 0V28H19", M: "M1 28V0L10 16L19 0V28", N: "M2 28V0L18 28V0",
  P: "M2 28V0H11Q26 7 11 14H2", Q: "M10 0C-3 0 -3 28 10 28C23 28 23 0 10 0M11 20L21 30",
  R: "M2 28V0H11Q26 7 11 14H2M10 14L20 28", S: "M18 3Q3 -5 2 7Q1 14 11 14Q25 17 18 25Q10 32 2 25",
  T: "M0 0H20M10 0V28", U: "M2 0V20Q10 36 18 20V0", V: "M1 0L10 28L19 0",
  W: "M0 0L4 28L10 12L16 28L20 0", X: "M1 0L19 28M19 0L1 28",
  Y: "M1 0L10 14L19 0M10 14V28", Z: "M1 0H19L1 28H19",
};

export function createCaptcha() {
  makeRoom(captchas);
  const id = crypto.randomBytes(32).toString("hex");
  const alphabet = Object.keys(letters);
  const characters = Array.from({ length: 6 }, (_, index) => index < 3
    ? String(crypto.randomInt(2, 10)) : alphabet[crypto.randomInt(alphabet.length)]);
  for (let i = characters.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j], characters[i]];
  }
  const answer = characters.join("");
  const paths = [...answer].map((character, index) =>
    `<path d="${letters[character] ?? digits[Number(character)]}" transform="translate(${12 + index * 34} ${18 + crypto.randomInt(9)}) rotate(${crypto.randomInt(-12, 13)} 10 14)"/>`
  ).join("");
  const noise = Array.from({ length: 7 }, () =>
    `<path d="M${crypto.randomInt(220)} ${crypto.randomInt(70)} Q${crypto.randomInt(220)} ${crypto.randomInt(70)} ${crypto.randomInt(220)} ${crypto.randomInt(70)}"/>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="70" viewBox="0 0 220 70"><rect width="220" height="70" fill="#f1f5f9"/><g fill="none" stroke="#94a3b8" stroke-width="1">${noise}</g><g fill="none" stroke="#1e3a8a" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
  captchas.set(id, { digest: digest(`${id}:${answer}`), expiresAt: Date.now() + CAPTCHA_TTL });
  return { captchaId: id, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
}

export function verifyCaptcha(id: string, answer: string) {
  const entry = captchas.get(id);
  captchas.delete(id); // Un solo intento, incluso si la respuesta es incorrecta.
  if (!entry || entry.expiresAt <= Date.now() ||
      !crypto.timingSafeEqual(entry.digest, digest(`${id}:${answer.trim().toUpperCase()}`))) {
    throw ApiError.badRequest("CAPTCHA incorrecto o vencido. Completa uno nuevo.");
  }
}

async function sendLoginCode(correo: string, code: string, purpose: LoginEntry["purpose"]) {
  await sendMail({
    to: correo, subject: "SGIAC: codigo de acceso",
    ...academicCodeMail({ title: purpose === "enable" ? "Activa la verificación en dos pasos" : purpose === "disable" ? "Confirma la desactivación de la verificación en dos pasos" : "Confirma tu inicio de sesión",
      description: "Protegemos el acceso a tu cuenta institucional. Completa la acción que solicitaste con el siguiente código.", code, minutes: 5 }),
  });
}

export async function beginLoginVerification(user: {
  idUsuario: bigint | number; correo: string; contrasenaHash: string;
}, admin: boolean, purpose: LoginEntry["purpose"] = "login") {
  makeRoom(logins);
  const idUsuario = user.idUsuario.toString();
  for (const entry of logins.values()) {
    if (entry.idUsuario === idUsuario && Date.now() - entry.createdAt < 60_000) {
      throw new ApiError(429, "Espera un minuto antes de solicitar otro codigo.");
    }
  }
  const challengeId = crypto.randomBytes(32).toString("hex");
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const entry: LoginEntry = {
    idUsuario, correo: user.correo, passwordHash: user.contrasenaHash, admin, purpose,
    digest: digest(`${challengeId}:${code}`), expiresAt: Date.now() + CODE_TTL,
    attempts: 0, createdAt: Date.now(), ready: false,
  };
  logins.set(challengeId, entry);
  try {
    await sendLoginCode(user.correo, code, purpose);
    entry.ready = true;
  } catch (error) {
    logins.delete(challengeId);
    throw error;
  }
  // Un nuevo envio invalida los codigos anteriores de esta cuenta.
  for (const [id, previous] of logins) {
    if (id !== challengeId && previous.idUsuario === idUsuario) logins.delete(id);
  }
  const [local, domain] = user.correo.split("@");
  return {
    requiresTwoFactor: true as const, challengeId, expiresIn: CODE_TTL / 1000,
    maskedEmail: `${local.slice(0, 1)}***@${domain}`,
  };
}

export function consumeLoginVerification(id: string, code: string, admin: boolean,
  purpose: LoginEntry["purpose"] = "login", idUsuario?: string) {
  const invalidCode = (message: string) => purpose === "login"
    ? ApiError.unauthorized(message) : ApiError.badRequest(message);
  const entry = logins.get(id);
  if (!entry || !entry.ready || entry.expiresAt <= Date.now()) {
    logins.delete(id);
    throw invalidCode("El codigo vencio. Vuelve atras y solicita otro codigo.");
  }
  entry.attempts += 1;
  if (entry.admin !== admin || entry.purpose !== purpose ||
      (idUsuario !== undefined && entry.idUsuario !== idUsuario) ||
      !crypto.timingSafeEqual(entry.digest, digest(`${id}:${code}`))) {
    if (entry.attempts >= 5) logins.delete(id);
    throw invalidCode(entry.attempts >= 5
      ? "Se agotaron los intentos. Vuelve atras y solicita otro codigo."
      : "Codigo de verificacion incorrecto.");
  }
  logins.delete(id); // Consumir antes de cualquier operacion asincrona.
  return entry;
}
