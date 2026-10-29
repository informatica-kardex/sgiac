import { prisma } from "../../database/prisma";
import { sendMail } from "../../utils/mail";
import { env } from "../../config/env";
import { TelegramApiError, TelegramClient } from "../telegram/telegram.client";

export function mensajeRecojo(s: { codigo: string | null; documento: string; fechaRecojo: Date | null; hojas: number | null; lugar: string; requisitos: string }) {
  if (s.hojas === null || !s.fechaRecojo) throw new Error("Faltan datos de recojo confirmados");
  const fecha = s.fechaRecojo!.toLocaleString("es-BO", { timeZone: "America/La_Paz", dateStyle: "full", timeStyle: "short" });
  return { subject: `Tu documento está listo · ${s.codigo}`,
    text: `Tu ${s.documento.toLowerCase()} está listo para recoger.\n\nFicha: ${s.codigo}\nRecojo a partir de: ${fecha} (hora de Bolivia).\nLugar: ${s.lugar}\nHojas en blanco que debes traer: ${s.hojas}.\n${s.requisitos}\n\nPresenta tu ficha y tu identificación. Consulta la información actualizada en tu sesión de estudiante, en Mis documentos.\n\nSGIAC · Kardex` };
}

// Cola persistente: una falla del proveedor no revierte el cambio de estado.
// Bloqueo de solicitud y aviso: evita envíos simultáneos y avisos antiguos tras reprogramar.
export async function procesarCorreosDocumentos() {
  const candidatos = await prisma.correoDocumento.findMany({ where: { estado: "PENDIENTE", proximoIntento: { lte: new Date() } }, orderBy: { id: "asc" }, take: 10 });
  for (const candidato of candidatos) {
    await prisma.$transaction(async tx => {
      const locked = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM solicitud_documento WHERE id = ${candidato.idSolicitud} FOR UPDATE SKIP LOCKED`;
      if (!locked.length) return;
      const aviso = await tx.correoDocumento.findUnique({ where: { id: candidato.id } });
      if (!aviso || aviso.estado !== "PENDIENTE" || aviso.proximoIntento > new Date()) return;
      const s = await tx.solicitudDocumento.findUniqueOrThrow({ where: { id: candidato.idSolicitud }, include: { estudiante: { include: { usuario: true } } } });
      const usuario = s.estudiante.usuario;
      if (s.estado !== "LISTA" || !usuario?.correoVerificado || usuario.estado !== "ACTIVO" || usuario.debeCambiarPassword) {
        await tx.correoDocumento.update({ where: { id: aviso.id }, data: { estado: "OMITIDO" } }); return;
      }
      let chatId: bigint | null = null;
      if (aviso.canal === "TELEGRAM") {
        await tx.$queryRaw`SELECT id_usuario FROM vinculo_telegram WHERE id_usuario = ${usuario.idUsuario} FOR UPDATE`;
        chatId = (await tx.vinculoTelegram.findUnique({ where: { idUsuario: usuario.idUsuario } }))?.chatId ?? null;
        if (!chatId) { await tx.correoDocumento.update({ where: { id: aviso.id }, data: { estado: "OMITIDO" } }); return; }
      }
      try {
        if (s.hojas === null || !s.fechaRecojo) throw new Error("Faltan datos de recojo confirmados");
        if (aviso.canal === "TELEGRAM") {
          if (!env.telegramBotToken) throw new Error("Telegram no configurado");
          // Mensaje breve: no expone notas, CI, correo ni otros datos académicos sensibles.
          const text = `Tu documento está listo.\n\nFicha: ${s.codigo}\nDocumento: ${s.documento}\nRecoge a partir de: ${s.fechaRecojo!.toLocaleString("es-BO", { timeZone: "America/La_Paz" })} (Bolivia).\nLugar: ${s.lugar}\nTrae ${s.hojas} hojas en blanco y tu identificación.\n\nConsulta las indicaciones completas en tu sesión → Mis documentos.\n/desvincular para desactivar estos avisos.`;
          await new TelegramClient(env.telegramBotToken).call("sendMessage", { chat_id: String(chatId), text, link_preview_options: { is_disabled: true } });
        } else await sendMail({ to: usuario.correo, ...mensajeRecojo(s) });
        await tx.correoDocumento.update({ where: { id: aviso.id }, data: { estado: "ENVIADO", enviadoEn: new Date(), intentos: { increment: 1 } } });
      } catch (error) {
        const intentos = aviso.intentos + 1;
        await tx.correoDocumento.update({ where: { id: aviso.id }, data: {
          intentos, estado: intentos >= 5 ? "ERROR" : "PENDIENTE", proximoIntento: new Date(Date.now() + Math.max(60000 * 2 ** intentos, error instanceof TelegramApiError ? error.retryAfter * 1000 : 0)),
        } });
      }
    }, { timeout: 30000, maxWait: 5000 });
  }
}
let timer: ReturnType<typeof setInterval> | undefined;
let running: Promise<void> | undefined;
export function iniciarCorreosDocumentos() {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = procesarCorreosDocumentos().catch(() => console.error("[DOCUMENTOS] No se pudo procesar la cola de avisos; se reintentará.")).finally(() => { running = undefined; });
  };
  timer = setInterval(tick, 30000); timer.unref(); tick();
}
export async function detenerCorreosDocumentos() { clearInterval(timer); timer = undefined; await running; }
