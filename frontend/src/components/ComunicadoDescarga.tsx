import { useState } from "react";
import type { Comunicado } from "../api/types";

type Props = { url: string } | { comunicado: Comunicado };

export function ComunicadoDescarga(props: Props) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState("");
  const icono = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>;

  if ("url" in props) {
    return <a href={props.url} className="comunicado-descarga">{icono} Descargar</a>;
  }

  async function descargar() {
    if (!("comunicado" in props) || descargando) return;
    setDescargando(true);
    setError("");
    try {
      const { descargarComunicadoPdf } = await import("../utils/comunicadoPdf");
      await descargarComunicadoPdf(props.comunicado);
    } catch {
      setError("No se pudo descargar el comunicado. Inténtalo de nuevo.");
    } finally {
      setDescargando(false);
    }
  }

  return <>
    <button type="button" className="comunicado-descarga" disabled={descargando} aria-busy={descargando} onClick={() => void descargar()}>
      {icono} {descargando ? "Generando PDF…" : "Descargar"}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </>;
}
