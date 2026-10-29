import { setTimeout as delay } from "node:timers/promises";
import { Faq } from "../faq/faq.types";
import { TelegramApi, TelegramApiError } from "./telegram.client";
import { TelegramFaqBot, TelegramUpdate, TelegramPersonalHandler } from "./telegram.bot";

export class TelegramPolling {
  private readonly controller = new AbortController();
  private readonly bot: TelegramFaqBot;
  private task?: Promise<void>;
  private username: string | null = null;
  private available = false;

  constructor(private readonly api: TelegramApi, loadFaqs: () => Promise<Faq[]>, personal?: TelegramPersonalHandler) {
    this.bot = new TelegramFaqBot(api, loadFaqs, personal);
  }

  getPublicInfo() {
    return {
      available: this.available,
      url: this.available && this.username ? `https://t.me/${this.username}?start=faq` : null,
    };
  }

  start(): void {
    if (!this.task && !this.controller.signal.aborted) this.task = this.run();
  }

  async stop(): Promise<void> {
    this.available = false;
    this.controller.abort();
    await this.task;
  }

  private async run(): Promise<void> {
    const signal = this.controller.signal;
    let initialized = false;
    let offset = 0;
    let failures = 0;
    while (!signal.aborted) {
      try {
        if (!initialized) {
          const me = await this.api.call<{ username: string; is_bot: boolean }>("getMe", {}, signal);
          if (!me.is_bot || !/^[A-Za-z0-9_]+$/.test(me.username)) throw new TelegramApiError(401);
          const webhook = await this.api.call<{ url: string }>("getWebhookInfo", {}, signal);
          if (webhook.url) {
            console.error("Telegram: el bot tiene un webhook activo. Usa un bot dedicado sin webhook para SGIAC.");
            return;
          }
          await this.api.call("setMyCommands", {
            scope: { type: "all_private_chats" },
            commands: [
              { command: "start", description: "Iniciar el asistente de Kardex" },
              { command: "menu", description: "Ver los temas y preguntas frecuentes" },
              { command: "ayuda", description: "Cómo consultar al asistente" },
              { command: "misdocumentos", description: "Mis documentos (requiere vinculación voluntaria)" },
              { command: "desvincular", description: "Dejar de recibir avisos personales" },
            ],
          }, signal);
          await this.api.call("setChatMenuButton", { menu_button: { type: "commands" } }, signal);
          if (signal.aborted) return;
          this.username = me.username;
          initialized = true;
          console.log(`Telegram: asistente @${me.username} iniciado.`);
        }
        // La primera consulta comprueba que se puede recibir mensajes sin esperar 25s.
        const updates = await this.api.call<TelegramUpdate[]>("getUpdates", {
          offset, timeout: this.available ? 25 : 0, limit: 25, allowed_updates: ["message", "callback_query"],
        }, signal);
        if (signal.aborted) return;
        this.available = true;
        for (const update of updates) {
          if (signal.aborted) return;
          try {
            await this.bot.handle(update, signal);
          } catch (error) {
            // Un chat bloqueado o un mensaje inválido no deben detener la cola.
            if (!(error instanceof TelegramApiError) || ![400, 403].includes(error.code)) throw error;
            console.warn(`Telegram: no se pudo responder a una consulta (código ${error.code}).`);
          }
          offset = update.update_id + 1;
        }
        failures = 0;
      } catch (error) {
        this.available = false;
        if (signal.aborted) return;
        const code = error instanceof TelegramApiError ? error.code : 0;
        if ([401, 404, 409].includes(code)) {
          console.error(code === 409
            ? "Telegram: hay otro proceso o webhook usando este bot. Mantén una sola instancia y reinicia el backend."
            : "Telegram: token inválido. Revisa TELEGRAM_BOT_TOKEN y reinicia el backend.");
          return;
        }
        const seconds = Math.max(Math.min(2 ** Math.min(++failures, 5), 30), error instanceof TelegramApiError ? error.retryAfter : 0);
        console.warn(`Telegram: conexión temporalmente no disponible (código ${code}). Reintento en ${seconds}s.`);
        try { await delay(seconds * 1000, undefined, { signal }); } catch { return; }
      }
    }
  }
}
