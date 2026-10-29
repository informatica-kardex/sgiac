export class TelegramApiError extends Error {
  constructor(public readonly code: number, public readonly retryAfter = 0) {
    // No incluir la URL, el token ni la respuesta remota en los errores.
    super(`Telegram no pudo completar la solicitud (código ${code}).`);
  }
}

export interface TelegramApi {
  call<T>(method: string, payload?: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
}

export class TelegramClient implements TelegramApi {
  constructor(private readonly token: string) {}

  async call<T>(method: string, payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, method === "getUpdates" ? 35000 : 10000);
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = await response.json() as {
        ok: boolean; result: T; error_code?: number; parameters?: { retry_after?: number };
      };
      if (!response.ok || !data.ok) {
        throw new TelegramApiError(data.error_code || response.status, data.parameters?.retry_after);
      }
      return data.result;
    } catch (error) {
      if (error instanceof TelegramApiError) throw error;
      throw new TelegramApiError(0);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
}
