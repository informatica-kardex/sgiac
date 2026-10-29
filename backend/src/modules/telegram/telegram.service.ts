import { env } from "../../config/env";
import { FaqService } from "../faq/faq.service";
import { TelegramClient } from "./telegram.client";
import { TelegramPolling } from "./telegram.polling";
import { responderTelegramPersonal } from "./telegram.vinculo";

const faqs = new FaqService();
const polling = env.telegramBotToken
  ? new TelegramPolling(new TelegramClient(env.telegramBotToken), () => faqs.listarPublicadas(), responderTelegramPersonal)
  : null;

export const telegramService = {
  start: () => polling?.start(),
  stop: async () => { await polling?.stop(); },
  getPublicInfo: () => polling?.getPublicInfo() || { available: false, url: null },
};
