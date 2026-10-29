import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { ACTIVAS } from "../documentos/documento.rules";
import type { TelegramPersonalHandler } from "./telegram.bot";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
async function estudianteActivo(idUsuario: string) {
  const e = await prisma.estudiante.findUnique({ where: { id_usuario: BigInt(idUsuario) }, include: { usuario: true } });
  if (!e || e.usuario?.estado !== "ACTIVO" || !e.usuario.correoVerificado || e.usuario.debeCambiarPassword)
    throw ApiError.forbidden("Necesitas una cuenta de estudiante activa y verificada.");
  return e;
}
export const telegramVinculo = {
  async estado(idUsuario: string) {
    await estudianteActivo(idUsuario);
    const v = await prisma.vinculoTelegram.findUnique({ where: { idUsuario: BigInt(idUsuario) } });
    return { vinculado: !!v?.chatId, vinculadoEn: v?.vinculadoEn?.toISOString() ?? null };
  },
  async crear(idUsuario: string, botUrl: string | null) {
    await estudianteActivo(idUsuario);
    if (!botUrl || !/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=faq$/.test(botUrl)) throw new ApiError(503, "El bot no está disponible. Intenta más tarde.");
    const token = randomBytes(32).toString("base64url");
    const expiraEn = new Date(Date.now() + 10 * 60000);
    await prisma.$transaction(async tx => {
      // Serializa la generación, incluso antes de que exista una fila de vinculación.
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${BigInt(idUsuario)} FOR UPDATE`;
      const v = await tx.vinculoTelegram.findUnique({ where: { idUsuario: BigInt(idUsuario) } });
      if (v?.chatId) throw ApiError.conflict("Tu cuenta ya está vinculada. Desvincúlala antes de cambiar de Telegram.");
      await tx.vinculoTelegram.upsert({ where: { idUsuario: BigInt(idUsuario) }, create: { idUsuario: BigInt(idUsuario), tokenHash: hash(token), expiraEn }, update: { tokenHash: hash(token), expiraEn } });
    });
    return { url: botUrl.replace("start=faq", `start=sgiac_${token}`), expiraEn: expiraEn.toISOString() };
  },
  async desvincular(idUsuario: string) {
    await estudianteActivo(idUsuario);
    await prisma.vinculoTelegram.updateMany({ where: { idUsuario: BigInt(idUsuario) }, data: { chatId: null, tokenHash: null, expiraEn: null, vinculadoEn: null } });
    return null;
  },
  async consumir(token: string, chatId: number) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !Number.isSafeInteger(chatId) || chatId <= 0) return false;
    return prisma.$transaction(async tx => {
      const tokenHash = hash(token);
      const inicial = await tx.vinculoTelegram.findUnique({ where: { tokenHash } });
      if (!inicial) return false;
      // Mismo orden de bloqueos que crear(): usuario, vínculo.
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${inicial.idUsuario} FOR UPDATE`;
      await tx.$queryRaw`SELECT id_usuario FROM vinculo_telegram WHERE id_usuario = ${inicial.idUsuario} FOR UPDATE`;
      const v = await tx.vinculoTelegram.findUnique({ where: { idUsuario: inicial.idUsuario }, include: { usuario: { include: { estudiante: true } } } });
      if (!v || v.tokenHash !== tokenHash || !v.expiraEn || v.expiraEn <= new Date() || v.chatId ||
        v.usuario.estado !== "ACTIVO" || !v.usuario.correoVerificado || v.usuario.debeCambiarPassword || !v.usuario.estudiante) return false;
      // Un chat solo puede pertenecer a una cuenta. Evita carreras entre tokens de distintas cuentas.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(${BigInt(chatId)})`;
      if (await tx.vinculoTelegram.findUnique({ where: { chatId: BigInt(chatId) } })) return false;
      await tx.vinculoTelegram.update({ where: { idUsuario: v.idUsuario }, data: { chatId: BigInt(chatId), tokenHash: null, expiraEn: null, vinculadoEn: new Date() } });
      return true;
    });
  },
};

export const responderTelegramPersonal: TelegramPersonalHandler = async (chatId, input) => {
  const inicio = /^\/start(?:@\w+)?\s+sgiac_(\S+)\s*$/.exec(input);
  const respuesta = (text: string) => ({ text, buttons: [[{ text: "☰ Preguntas frecuentes", callback_data: "faq:menu:0" }]] });
  if (inicio) return respuesta(await telegramVinculo.consumir(inicio[1], chatId)
    ? "Tu cuenta de estudiante quedó vinculada voluntariamente. Recibirás aquí los avisos de documentos listos. Usa /misdocumentos para consultar tus solicitudes y /desvincular para dejar de recibir avisos."
    : "No se pudo vincular: el enlace venció, ya se usó o este Telegram pertenece a otra cuenta. Genera un enlace nuevo desde tu sesión en Mis documentos. No compartas tu enlace.");
  if (/^\/desvincular(?:@\w+)?\s*$/.test(input)) {
    await prisma.vinculoTelegram.updateMany({ where: { chatId: BigInt(chatId) }, data: { chatId: null, tokenHash: null, expiraEn: null, vinculadoEn: null } });
    return respuesta("Telegram desvinculado. Ya no recibirás avisos personales aquí. Puedes seguir consultando las preguntas frecuentes sin vincular tu cuenta.");
  }
  if (!/^\/misdocumentos(?:@\w+)?\s*$/.test(input)) return null;
  const v = await prisma.vinculoTelegram.findUnique({ where: { chatId: BigInt(chatId) }, include: { usuario: { include: { estudiante: true } } } });
  if (!v || v.usuario.estado !== "ACTIVO" || !v.usuario.correoVerificado || v.usuario.debeCambiarPassword || !v.usuario.estudiante)
    return respuesta("Para consultar solicitudes personales, vincula Telegram voluntariamente desde tu sesión de estudiante → Mis documentos. El menú de preguntas sigue disponible para todos.");
  const solicitudes = await prisma.solicitudDocumento.findMany({ where: { idEstudiante: v.usuario.estudiante.id_estudiante, estado: { in: ACTIVAS } }, orderBy: { id: "desc" }, take: 5 });
  if (!solicitudes.length) return respuesta("No tienes solicitudes de documentos pendientes. Puedes solicitar uno desde tu sesión de estudiante.");
  return respuesta("Tus solicitudes activas (hasta 5):\n\n" + solicitudes.map(s => `${s.codigo} · ${s.documento}\n${s.estado === "LISTA" ? `Listo. Recoge desde ${s.fechaRecojo!.toLocaleString("es-BO", { timeZone: "America/La_Paz" })} (Bolivia).\n${s.lugar}. Trae ${s.hojas} hojas en blanco.` : "En trámite. Espera la confirmación antes de acudir."}`).join("\n\n") + "\n\nConsulta todos los requisitos y el historial en Mis documentos.");
};
