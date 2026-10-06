import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfigTV, fichasApi } from "../../api/fichas.api";
import { comunicadoArchivoUrl, comunicadosApi } from "../../api/comunicados.api";
import { usePolling } from "../../hooks/usePolling";
import "../../styles/pantalla-atencion.css";

type Diapositiva = { id: string; titulo: string; texto: string; etiqueta: string; tipo?: "imagen" | "video"; url?: string };
const consejos: Diapositiva[] = [
  { id: "bienvenida", etiqueta: "Tu espacio universitario", titulo: "Bienvenido a Kardex", texto: "Estamos aquí para acompañarte en tus trámites." },
  { id: "documentos", etiqueta: "Prepara tu atención", titulo: "Ten tus documentos a mano", texto: "Revisa los requisitos de tu trámite antes de pasar a ventanilla." },
  { id: "cuenta", etiqueta: "Cuida tu información", titulo: "Tu contraseña es personal", texto: "Cierra tu sesión al usar una computadora compartida." },
];
const horaBolivia = (fecha: Date | string) => new Date(fecha).toLocaleTimeString("es-BO", { timeZone: "America/La_Paz", hour: "2-digit", minute: "2-digit", hour12: false });

function ContenidoPantalla({ locales }: { locales: Diapositiva[] }) {
  const load = useCallback(async () => (await comunicadosApi.listar(true)).data.data, []);
  const { data, error } = usePolling(load, 60000);
  const [indice, setIndice] = useState(0);
  const [fallida, setFallida] = useState<string | null>(null);
  const publicados: Diapositiva[] = (error ? [] : data ?? []).filter(c => c.estado === "publicado").slice(0, 8).map(c => {
    const imagen = c.adjuntos.find(a => a.tipo.startsWith("image/"));
    return { id: c.idComunicado, etiqueta: c.categoria, titulo: c.titulo, texto: c.resumen || c.contenido,
      ...(imagen ? { tipo: "imagen" as const, url: comunicadoArchivoUrl(imagen.url, true) } : {}) };
  });
  const slides = locales.length ? locales : publicados.length ? publicados : consejos;
  const slide = slides[indice % slides.length];
  const avanzar = useCallback(() => setIndice(i => i + 1), []);
  useEffect(() => { setIndice(0); }, [locales]);
  // Un fallo temporal de red no debe ocultar permanentemente un archivo de la lista.
  useEffect(() => { setFallida(null); }, [indice, slide.url]);
  useEffect(() => {
    const timer = setTimeout(avanzar, fallida === slide.url ? 5000 : slide.tipo === "video" ? 45000 : 12000);
    return () => clearTimeout(timer);
  }, [slide.id, slide.url, slide.tipo, indice, fallida, avanzar]);
  const sinArchivo = fallida === slide.url;
  const mostrarArchivo = !!slide.tipo && !sinArchivo;
  return <section className={`tv-media ${mostrarArchivo ? "tv-media-with-file" : ""}`} aria-label="Información y multimedia">
    {!mostrarArchivo && <div className="tv-media-heading"><span>INFORMÁTICA</span><span>Comunidad universitaria</span></div>}
    <div className="tv-slide" key={`${slide.id}-${slide.tipo === "video" ? indice : 0}`}>
      {slide.tipo === "video" && !sinArchivo ? <video src={slide.url} autoPlay muted playsInline onEnded={avanzar} onError={() => setFallida(slide.url ?? null)} aria-label={slide.titulo} />
        : slide.tipo === "imagen" && !sinArchivo ? <img src={slide.url} alt={slide.titulo} onError={() => setFallida(slide.url ?? null)} />
        : <div className="tv-slide-illustration" aria-hidden="true"><div className="tv-orbit"/><img src="/images/kardex.png" alt="" /></div>}
      {!mostrarArchivo && <div className="tv-slide-copy"><span>{sinArchivo ? "Archivo no disponible" : slide.etiqueta}</span><h2>{sinArchivo ? "Bienvenido a Kardex" : slide.titulo}</h2>{!slide.tipo && <p>{slide.texto.slice(0, 180)}</p>}</div>}
    </div>
    {slides.length > 1 && <div className="tv-slide-dots" aria-label={`Contenido ${indice % slides.length + 1} de ${slides.length}`}>{slides.map((s, i) => <span key={s.id} className={i === indice % slides.length ? "active" : ""} />)}</div>}
  </section>;
}

export default function PantallaAtencionPage() {
  const load = useCallback(async () => (await fichasApi.tablero()).data.data, []);
  const { data, error, loading, updatedAt } = usePolling(load);
  const [now, setNow] = useState(new Date());
  const voz = data?.tv?.voz ?? false;
  const claveArchivos = JSON.stringify(data?.tv?.archivos ?? []);
  const locales = useMemo<Diapositiva[]>(() => (JSON.parse(claveArchivos) as ConfigTV["archivos"]).map(a => ({
    id: a.id, titulo: a.nombre.replace(/\.[^.]+$/, ""), texto: "", etiqueta: "Kardex · Informática", tipo: a.tipo, url: comunicadoArchivoUrl(a.url),
  })), [claveArchivos]);
  const ultimaPrueba = useRef<string | null>(null);
  const ultimoEvento = useRef<string | null>(null);
  const [destello, setDestello] = useState<string | null>(null);
  const hoy = new Date(now.getTime() - 4 * 3600000).toISOString().slice(0, 10);
  const historial = data?.fecha === hoy ? data.ultimosLlamados ?? [] : [];
  const ultimo = historial[0];
  const desactualizado = !!error || !!updatedAt && now.getTime() - updatedAt.getTime() > 20000;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!ultimo || desactualizado || ultimoEvento.current === ultimo.evento) return;
    const anterior = ultimoEvento.current;
    ultimoEvento.current = ultimo.evento;
    setDestello(ultimo.evento);
    // La primera carga recupera el historial sin volver a anunciar turnos antiguos.
    if (anterior && voz && "speechSynthesis" in window) {
      const nuevos = historial.filter(h => BigInt(h.evento) > BigInt(anterior)).reverse();
      window.speechSynthesis.cancel();
      for (const llamado of nuevos) {
        if (llamado.estado !== "LLAMADA") continue;
        const mensaje = new SpeechSynthesisUtterance(`Ficha ${llamado.codigo.replace("-", ", ")}. Pase a ${llamado.puesto}.`);
        mensaje.lang = "es-BO";
        window.speechSynthesis.speak(mensaje);
      }
    }
  }, [ultimo, historial, desactualizado, voz]);
  useEffect(() => {
    if (!voz && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [voz]);
  useEffect(() => {
    const prueba = data?.tv?.pruebaVoz;
    if (!prueba || desactualizado || prueba === ultimaPrueba.current) return;
    const anterior = ultimaPrueba.current;
    ultimaPrueba.current = prueba;
    if (anterior && voz) anunciarPrueba();
  }, [data?.tv?.pruebaVoz, desactualizado, voz]);
  useEffect(() => () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);
  function anunciarPrueba() {
    if ("speechSynthesis" in window) {
      const mensaje = new SpeechSynthesisUtterance("Anuncios de Kardex activados");
      mensaje.lang = "es-BO"; window.speechSynthesis.cancel(); window.speechSynthesis.speak(mensaje);
    }
  }

  return <main className="tv-screen" onPointerDown={() => { if (voz) anunciarPrueba(); }}>
    <header className="tv-header"><div className="tv-brand"><img src="/images/kardex.png" alt=""/><span>Kardex<small>Carrera de Informática</small></span></div><div className="tv-header-center"><span className={`tv-live-dot ${desactualizado ? "offline" : ""}`} /> Atención al estudiante</div><div className="tv-header-right"><time dateTime={now.toISOString()}>{horaBolivia(now)}</time></div></header>
    {desactualizado && <div className="tv-connection-warning" role="alert">Conexión interrumpida · Últimos datos recibidos {updatedAt ? horaBolivia(updatedAt) : "—"} · Reconectando…</div>}
    <div className="tv-grid">
      <section className={`tv-call ${desactualizado ? "tv-call-stale" : ""}`} aria-label="Último llamado" aria-live="polite" aria-atomic="true">
        <div key={destello} className={destello && !desactualizado ? "tv-call-glow" : ""} aria-hidden="true" />
        <div className="tv-call-top"><span>{ultimo?.estado === "LLAMADA" && !desactualizado ? "ES TU TURNO" : "ÚLTIMO LLAMADO"}</span><span className="tv-call-symbol" aria-hidden="true">↗</span></div>
        <div className="tv-call-number"><p>FICHA</p><h1>{ultimo?.codigo ?? "—"}</h1><p className="tv-call-tramite">{ultimo?.tramite ?? (loading ? "Conectando…" : "Esperando el próximo llamado")}</p></div>
        <div className="tv-destination"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="M10 40h55M43 16l24 24-24 24" /></svg><div><span>{ultimo?.estado === "LLAMADA" && !desactualizado ? "PASA A" : "PUESTO"}</span><strong>{ultimo?.puesto ?? "Kardex"}</strong></div></div>
        <p className="tv-call-status">{desactualizado ? "Verifica el llamado con Kardex" : ultimo?.estado === "ATENDIDA" ? "Atención finalizada" : ultimo?.estado === "NO PRESENTADA" ? "Turno no presentado" : ultimo ? "Ten tus documentos a mano" : "Tu código aparecerá aquí"}</p>
      </section>

      <aside className="tv-history" aria-label="Últimos cinco llamados"><div className="tv-section-title"><h2>Llamados recientes</h2><span>FICHA <b>→</b> PUESTO</span></div><ol>{historial.map((h, i) => <li key={h.codigo} className={i === 0 ? "tv-history-latest" : ""}><div><strong>{h.codigo}</strong><time dateTime={h.llamadaEn}>{horaBolivia(h.llamadaEn)}</time></div><p><span aria-hidden="true">→</span> {h.puesto}</p></li>)}</ol>{!historial.length && <p className="tv-history-empty">Los últimos cinco turnos permanecerán aquí.</p>}</aside>
      <ContenidoPantalla key={data?.tv?.revision ?? "inicial"} locales={locales} />
    </div>
    <footer className="tv-footer"><span><b>KARDEX</b> · Estamos para ayudarte</span><span>Revisa tu código y acércate a la ventanilla indicada.</span><span>{new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", day: "2-digit", month: "long" }).format(now)}</span></footer>
  </main>;
}
