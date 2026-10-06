import { useEffect, useRef, useState } from "react";
import { AxiosError } from "axios";

export function mensajeError(error: unknown) {
  return error instanceof AxiosError ? error.response?.data?.message || "No se pudo conectar. Intenta nuevamente." : "No se pudo completar la operación.";
}

// Una sola consulta en vuelo, sin respuestas tardías al cambiar de fecha o salir.
export function usePolling<T>(load: () => Promise<T>, interval = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let busy = false;
    let again = false;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true); setData(null); setError(""); setUpdatedAt(null);
    async function poll() {
      if (busy) { again = true; return; }
      clearTimeout(timer);
      busy = true;
      try {
        const value = await load();
        if (active) { setData(value); setError(""); setUpdatedAt(new Date()); }
      } catch (e) { if (active) setError(mensajeError(e)); }
      finally {
        busy = false;
        if (active) {
          setLoading(false);
          timer = setTimeout(poll, again ? 0 : interval);
          again = false;
        }
      }
    }
    refreshRef.current = () => { void poll(); };
    void poll();
    return () => { active = false; clearTimeout(timer); refreshRef.current = () => {}; };
  }, [load, interval]);
  return { data, error, loading, updatedAt, refresh: () => refreshRef.current() };
}
