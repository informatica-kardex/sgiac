import { useEffect, useId, useState } from "react";
import { telegramApi, TelegramInfo } from "../../api/telegram.api";

export function TelegramHelpCard() {
  const [info, setInfo] = useState<TelegramInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const descriptionId = useId();

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const { data } = await telegramApi.obtener(controller.signal);
        if (!controller.signal.aborted) setInfo(data.data);
      } catch {
        if (!controller.signal.aborted) setInfo(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const refresh = window.setInterval(() => { void load(); }, 30000);
    return () => { controller.abort(); window.clearInterval(refresh); };
  }, []);

  const url = info?.available && info.url && /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=faq$/.test(info.url) ? info.url : null;

  return (
    <aside className="portal-telegram-card" aria-label="Asistente de Telegram">
      <div className="portal-telegram-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M21.4 3.6 18.2 20c-.2 1.1-.9 1.4-1.8.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L5.8 13.8 1 12.3c-1-.3-1-1 .2-1.5L20 3.5c.9-.3 1.7.2 1.4 1.1Z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="portal-telegram-eyebrow">AYUDA EN TELEGRAM</p>
        <h2 className="text-lg font-bold">Tus dudas, a un mensaje de distancia</h2>
        <p className="mt-1 text-sm">Consulta sobre matrícula, Kardex, horarios y tu cuenta con nuestro menú de preguntas.</p>
        <p id={descriptionId} className="mt-2 text-xs" role="status">
          {loading ? "Comprobando disponibilidad del asistente…" : url
            ? "Abre Telegram y pulsa Iniciar para recibir el menú de ayuda."
            : "Telegram no está disponible en este momento. Puedes consultar las respuestas de esta página."}
        </p>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="portal-telegram-button" aria-describedby={descriptionId}>
          Abrir bot en Telegram <span aria-hidden="true">↗</span>
          <span className="sr-only"> (se abre en una nueva pestaña)</span>
        </a>
      ) : (
        <button type="button" disabled className="portal-telegram-button" aria-describedby={descriptionId}>
          {loading ? "Conectando…" : "Bot no disponible"}
        </button>
      )}
    </aside>
  );
}
