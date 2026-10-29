import { useEffect, useState } from "react";
import { Comunicado } from "../api/types";
import { comunicadoArchivoUrl } from "../api/comunicados.api";
import { ComunicadoDescarga } from "./ComunicadoDescarga";
import "../styles/comunicado-galeria.css";

interface Props {
  imagenes: Comunicado["adjuntos"];
  titulo: string;
  compact?: boolean;
  descargar?: boolean;
}

export function ComunicadoGaleria(props: Props) {
  if (!props.imagenes.length) return null;
  // Reiniciar posición y temporizador al cambiar el conjunto de imágenes.
  return <Carrusel key={props.imagenes.map(a => `${a.idAdjunto}:${a.url}`).join("|")} {...props} />;
}

function Carrusel({ imagenes, titulo, compact = false, descargar = false }: Props) {
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [oculto, setOculto] = useState(document.hidden);
  const [reducirMovimiento, setReducirMovimiento] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const varias = imagenes.length > 1;
  const automatico = varias && !pausado && !hover && !focus && !oculto && !reducirMovimiento;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const movimiento = () => setReducirMovimiento(media.matches);
    const visibilidad = () => setOculto(document.hidden);
    media.addEventListener("change", movimiento);
    document.addEventListener("visibilitychange", visibilidad);
    return () => { media.removeEventListener("change", movimiento); document.removeEventListener("visibilitychange", visibilidad); };
  }, []);

  useEffect(() => {
    if (!automatico) return;
    const timer = window.setTimeout(() => setIndice(actual => (actual + 1) % imagenes.length), 5000);
    return () => window.clearTimeout(timer);
  }, [automatico, indice, imagenes.length]);

  const mover = (paso: number) => setIndice(actual => (actual + paso + imagenes.length) % imagenes.length);

  return <div className={`comunicado-galeria${compact ? " comunicado-galeria--compacta" : ""}`}>
    <div className="comunicado-carrusel" role="region" aria-roledescription={varias ? "carrusel" : undefined} aria-label={`Imágenes de ${titulo}`}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocus(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocus(false); }}
      onKeyDown={event => {
        if (varias && (event.key === "ArrowLeft" || event.key === "ArrowRight")) { event.preventDefault(); mover(event.key === "ArrowLeft" ? -1 : 1); }
      }}>
      <div className="comunicado-carrusel-ventana">
        <div className="comunicado-carrusel-pista" style={{ transform: `translateX(-${indice * 100}%)` }} aria-live={automatico ? "off" : "polite"}>
          {imagenes.map((imagen, posicion) => <div key={imagen.idAdjunto} className="comunicado-carrusel-diapositiva" role="group" aria-roledescription="diapositiva" aria-label={`${posicion + 1} de ${imagenes.length}`} aria-hidden={posicion !== indice}>
            <img src={comunicadoArchivoUrl(imagen.url, true)} alt={`${titulo} — ${imagen.nombre}`} loading="lazy" />
          </div>)}
        </div>
        {varias && <>
          <button type="button" className="comunicado-carrusel-flecha comunicado-carrusel-anterior" aria-label="Imagen anterior" onClick={() => mover(-1)}>‹</button>
          <button type="button" className="comunicado-carrusel-flecha comunicado-carrusel-siguiente" aria-label="Imagen siguiente" onClick={() => mover(1)}>›</button>
        </>}
      </div>
      {varias && <div className="comunicado-carrusel-controles">
        <span className="comunicado-carrusel-contador">{indice + 1} / {imagenes.length}</span>
        <div className="comunicado-carrusel-puntos" aria-label="Seleccionar imagen">
          {imagenes.map((imagen, posicion) => <button key={imagen.idAdjunto} type="button" aria-label={`Ir a imagen ${posicion + 1}`} aria-pressed={posicion === indice} onClick={() => setIndice(posicion)}><span /></button>)}
        </div>
        {!reducirMovimiento && <button type="button" className="comunicado-carrusel-pausa" aria-label={pausado ? "Reanudar carrusel" : "Pausar carrusel"} onClick={() => setPausado(actual => !actual)}>{pausado ? "▶" : "Ⅱ"}</button>}
      </div>}
    </div>
    {descargar && <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 break-words text-sm text-slate-600">{imagenes[indice].nombre}</p>
      <ComunicadoDescarga url={comunicadoArchivoUrl(imagenes[indice].url, true, true)} />
    </div>}
  </div>;
}
