import { axiosClient } from "./axiosClient";
import { ApiEnvelope } from "./types";

export interface TelegramInfo {
  available: boolean;
  url: string | null;
}

export const telegramApi = {
  obtener: (signal?: AbortSignal) => axiosClient.get<ApiEnvelope<TelegramInfo>>("/telegram", { signal, timeout: 5000 }),
};
