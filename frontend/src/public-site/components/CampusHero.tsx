import { ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PortalIcon } from "./PortalIcon";

export const campusPhotos = [
  { id: "edificio", title: "Nuestra carrera", caption: "Carrera de Informática · UMSA", file: "Edificio_de_la_Carrera_de_Informática_de_La_Umsa.jpg" },
  { id: "patio", title: "Nuestro encuentro", caption: "Segundo patio del Monoblock · UMSA", file: "Segundo_Patio_del_Monoblock_UMSA_con_entrada_ala_Carrera_de_Informática.jpg" },
  { id: "informatica", title: "Nuestra comunidad", caption: "Informática · La Paz, Bolivia", file: "Carrera_de_Informática_de_La_Universidad_Mayor_de_San_Andrés_en_el_Departamento_de_La_Paz,_Bolivia.jpg" },
];

export function CampusHero({ student = false, name, aside }: { student?: boolean; name?: string; aside?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState([0]);
  const [ready, setReady] = useState<number[]>([]);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(!document.hidden);
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
  const touch = useRef<{ x: number; y: number } | null>(null);
  const playing = !paused && !hover && visible && !reduced && !saveData;
  function go(next: number, manual = false) {
    const value = (next + campusPhotos.length) % campusPhotos.length;
    setVisited(previous => previous.includes(value) ? previous : [...previous, value]);
    setIndex(value);
    if (manual) setPaused(true);
  }
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduced(media.matches);
    const onVisibility = () => setVisible(!document.hidden);
    media.addEventListener("change", onMotion); document.addEventListener("visibilitychange", onVisibility);
    return () => { media.removeEventListener("change", onMotion); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(index + 1), 8000);
    return () => window.clearTimeout(timer);
  }, [index, playing]);
  // Keep the previous photograph visible while the next local asset decodes.
  const displayed = ready.includes(index) ? index : ready[ready.length - 1] ?? 0;
  const photo = campusPhotos[displayed];
  return <section className={`campus-hero${student ? " campus-hero-student" : ""}`} aria-label="Bienvenida y fotografías de la carrera"
    onPointerEnter={e => { if (e.pointerType === "mouse") setHover(true); }} onPointerLeave={() => setHover(false)}
    onFocusCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !(e.target as HTMLElement).closest("[data-rotation]")) setPaused(true); }}
    onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
    onTouchEnd={e => { const start = touch.current; touch.current = null; if (!start) return; const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1), true); }}>
    <div className="campus-photos" aria-hidden="true">
      {campusPhotos.map((p, i) => visited.includes(i) && <img key={p.id} className={displayed === i ? "is-active" : ""} src={`/images/campus/${p.id}-1280.webp`} srcSet={`/images/campus/${p.id}-640.webp 640w, /images/campus/${p.id}-1280.webp 1280w`} sizes="100vw" alt="" width="1280" height={p.id === "edificio" ? 658 : 623} decoding="async" fetchPriority={i === 0 ? "high" : "low"} onLoad={() => setReady(previous => previous.includes(i) ? previous : [...previous, i])} onError={() => setPaused(true)} />)}
    </div>
    <div className="container-public campus-hero-content">
      <div className="campus-hero-copy">
        <p className="campus-eyebrow"><span className="campus-small-line" />{student ? "TU ESPACIO EN INFORMÁTICA" : "KARDEX · CARRERA DE INFORMÁTICA"}</p>
        <h1>{student ? <>Hola, {name || "estudiante"}.<br/><span>¿Qué sigue hoy?</span></> : <>Tu vida universitaria,<br/><span>más cerca.</span></>}</h1>
        <p className="campus-hero-description">{student ? "Tus fichas, tus horarios y las novedades de la carrera. Todo listo para tu próximo paso." : "Menos vueltas. Más tiempo para lo que importa. Encuentra tus horarios, entérate de las novedades y gestiona tu atención en Kardex."}</p>
        <div className="campus-hero-actions">
          <Link className="campus-button campus-button-accent" to={student ? "/usuario/fichas?solicitar=1" : "/atencion"}>{student ? "Solicitar ficha" : "Generar ficha"}<PortalIcon name="arrow" size={18}/></Link>
          <Link className="campus-button campus-button-glass" to={student ? "/usuario/arma-tu-horario" : "/horarios"}><PortalIcon name="calendar" size={18}/>{student ? "Arma tu horario" : "Consultar horarios"}</Link>
        </div>
        <p className="campus-hero-note"><PortalIcon name="check" size={15}/> {student ? "Tu cuenta, tus trámites, a tu ritmo." : "Información de la carrera, en un solo lugar."}</p>
      </div>
      <div className="campus-hero-aside">{aside || <div className="campus-location"><PortalIcon name="pin" size={18}/><div><span>NUESTRO CAMPUS</span><p>{photo.caption}</p></div></div>}</div>
    </div>
    <div className="container-public campus-carousel-bar" role="group" aria-roledescription="carrusel" aria-label="Fotografías del campus">
      <div className="campus-photo-tabs">{campusPhotos.map((p, i) => <button key={p.id} type="button" onClick={() => go(i, true)} aria-label={`Ver foto ${i + 1}: ${p.title}`} aria-pressed={index === i} className={index === i ? "is-active" : ""}><span>0{i + 1}</span>{p.title}<i aria-hidden="true"/></button>)}</div>
      <div className="campus-photo-controls">
        {!reduced && !saveData && <button data-rotation type="button" onClick={() => setPaused(p => !p)} aria-label={paused ? "Reanudar fotos" : "Pausar fotos"} title={paused ? "Reanudar fotos" : "Pausar fotos"}><PortalIcon name={paused ? "play" : "pause"} size={16}/></button>}
        <button type="button" onClick={() => go(index - 1, true)} aria-label="Foto anterior"><PortalIcon name="left" size={18}/></button>
        <button type="button" onClick={() => go(index + 1, true)} aria-label="Foto siguiente"><PortalIcon name="right" size={18}/></button>
      </div>
      <span className="sr-only" aria-live={paused ? "polite" : "off"}>{photo.caption}. Foto {displayed + 1} de {campusPhotos.length}.</span>
    </div>
  </section>;
}

export function CampusCredits() {
  return <details className="campus-credits"><summary>Fotografías de nuestra carrera <span aria-hidden="true">+</span></summary><p>Fotografías de Lajlectora, vía Wikimedia Commons, bajo <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Versiones redimensionadas y comprimidas para este portal, bajo la misma licencia.</p><ul>{campusPhotos.map(p => <li key={p.id}><a href={`https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file)}`} target="_blank" rel="noreferrer">{p.caption} ↗</a></li>)}</ul></details>;
}
