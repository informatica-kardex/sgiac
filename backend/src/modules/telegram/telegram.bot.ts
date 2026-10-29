import { Faq } from "../faq/faq.types";
import { TelegramApi, TelegramApiError } from "./telegram.client";

export interface TelegramUpdate {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string } };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number; type: string } };
  };
}

type Button = { text: string; callback_data: string };
type Reply = { text: string; buttons: Button[][] };
export type TelegramPersonalHandler = (chatId: number, input: string) => Promise<Reply | null>;
const PAGE_SIZE = 8;
const menuButton: Button[] = [{ text: "☰ Volver al menú", callback_data: "faq:menu:0" }];
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const label = (text: string) => Array.from(text).length > 60 ? Array.from(text).slice(0, 57).join("") + "…" : text;

function paginated(items: Button[], requestedPage: number, prefix: string): Button[][] {
  const page = Math.max(0, Math.min(requestedPage, Math.ceil(items.length / PAGE_SIZE) - 1));
  const rows = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(item => [item]);
  const navigation: Button[] = [];
  if (page > 0) navigation.push({ text: "← Anterior", callback_data: `${prefix}:${page - 1}` });
  if ((page + 1) * PAGE_SIZE < items.length) navigation.push({ text: "Siguiente →", callback_data: `${prefix}:${page + 1}` });
  if (navigation.length) rows.push(navigation);
  return rows;
}

function menu(faqs: Faq[], page = 0, intro?: string): Reply {
  const categories = [...new Set(faqs.map(faq => faq.categoria))];
  const buttons = categories.map(category => ({
    text: label(category),
    callback_data: `faq:category:${faqs.find(faq => faq.categoria === category)!.idFaq}:0`,
  }));
  return {
    text: intro || (faqs.length
      ? "¡Hola! Soy el asistente de Kardex de SGIAC. 👋\n\nElige un tema para ver sus preguntas o escribe una palabra, como matrícula, horarios o contraseña.\n\nUsa /menu para volver a empezar. Las preguntas son públicas y no requieren vinculación.\n\nSi eres estudiante, puedes vincular Telegram voluntariamente desde tu sesión para recibir avisos y consultar /misdocumentos."
      : "Todavía no hay preguntas publicadas. Intenta nuevamente más tarde con /menu."),
    buttons: paginated(buttons, page, "faq:menu"),
  };
}

function answer(faq: Faq): Reply {
  return {
    text: `${faq.pregunta}\n\n${faq.respuesta}`,
    buttons: [[{ text: "← Más preguntas de este tema", callback_data: `faq:category:${faq.idFaq}:0` }], menuButton],
  };
}

export function buildFaqReply(allFaqs: Faq[], input: string, callback = false): Reply {
  // También filtrar aquí para impedir que una respuesta borrador aparezca por ID.
  const faqs = allFaqs.filter(faq => faq.estado === "publicada");
  if (callback) {
    const menuMatch = /^faq:menu:(\d{1,8})$/.exec(input);
    if (menuMatch) return menu(faqs, Number(menuMatch[1]));
    const categoryMatch = /^faq:category:(\d+):(\d{1,8})$/.exec(input);
    if (categoryMatch) {
      const selected = faqs.find(faq => faq.idFaq === Number(categoryMatch[1]));
      if (selected) {
        const questions = faqs.filter(faq => faq.categoria === selected.categoria);
        return {
          text: `${selected.categoria}\n\nSelecciona una pregunta:`,
          buttons: [...paginated(questions.map(faq => ({ text: label(faq.pregunta), callback_data: `faq:answer:${faq.idFaq}` })), Number(categoryMatch[2]), `faq:category:${selected.idFaq}`), menuButton],
        };
      }
    }
    const answerMatch = /^faq:answer:(\d+)$/.exec(input);
    const selected = answerMatch && faqs.find(faq => faq.idFaq === Number(answerMatch[1]));
    if (selected) return answer(selected);
    return menu(faqs, 0, "Esta opción ya no está disponible. Elige un tema del menú actualizado:");
  }

  const text = normalize(input.trim());
  if (/^\/(start|menu|preguntas|ayuda|help)(?:@\w+)?(?:\s|$)/.test(text) || /^(hola|menu|ayuda|inicio)$/.test(text)) return menu(faqs);
  const exact = faqs.find(faq => normalize(faq.pregunta) === text);
  if (exact) return answer(exact);
  const ignored = new Set(["como", "donde", "cuando", "para", "puedo", "quiero", "que", "del", "las", "los", "una", "por", "con", "mis", "cual", "sobre"]);
  const words = [...new Set(text.split(/[^a-z0-9]+/).filter(word => word.length > 2 && !ignored.has(word)))];
  const matches = faqs.map(faq => ({
    faq,
    score: words.reduce((score, word) => score + (normalize(`${faq.categoria} ${faq.pregunta}`).includes(word) ? 2 : normalize(faq.respuesta).includes(word) ? 1 : 0), 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (!matches.length) return menu(faqs, 0, "No encontré una pregunta relacionada. Prueba con otra palabra o elige un tema:");
  return {
    text: "Estas preguntas pueden ayudarte. Selecciona una para ver su respuesta:" + (matches.length > PAGE_SIZE ? "\n\nMostrando las primeras 8 coincidencias. Escribe más detalles para afinar la búsqueda." : ""),
    buttons: [...matches.slice(0, PAGE_SIZE).map(({ faq }) => [{ text: label(faq.pregunta), callback_data: `faq:answer:${faq.idFaq}` }]), menuButton],
  };
}

export class TelegramFaqBot {
  constructor(private readonly api: TelegramApi, private readonly loadFaqs: () => Promise<Faq[]>, private readonly personal?: TelegramPersonalHandler) {}

  async handle(update: TelegramUpdate, signal?: AbortSignal): Promise<void> {
    const callback = update.callback_query;
    const chat = callback ? callback.message?.chat : update.message?.chat;
    if (callback) {
      try {
        await this.api.call("answerCallbackQuery", { callback_query_id: callback.id }, signal);
      } catch (error) {
        // Los botones antiguos pueden tener un callback vencido; la respuesta sigue siendo útil.
        if (!(error instanceof TelegramApiError) || error.code !== 400) throw error;
      }
    }
    if (!chat || chat.type !== "private") return;
    const input = callback ? callback.data || "" : update.message?.text || "";
    const reply = (!callback && this.personal ? await this.personal(chat.id, input) : null) ?? buildFaqReply(await this.loadFaqs(), input, Boolean(callback));
    // 1800 puntos de código caben en 3600 unidades UTF-16, incluso con emojis.
    const characters = Array.from(reply.text);
    for (let start = 0; start < characters.length; start += 1800) {
      const last = start + 1800 >= characters.length;
      await this.api.call("sendMessage", {
        chat_id: chat.id,
        text: characters.slice(start, start + 1800).join(""),
        link_preview_options: { is_disabled: true },
        ...(last && reply.buttons.length ? { reply_markup: { inline_keyboard: reply.buttons } } : {}),
      }, signal);
    }
  }
}
