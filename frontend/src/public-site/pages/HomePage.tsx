import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Comunicado, Faq } from "../../api/types";
import { cargarResumenPortal } from "../../services/publicContent.service";
import { ComunicadoCard } from "../components/ComunicadoCard";
import { FaqAccordionItem } from "../components/FaqAccordionItem";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { CampusCredits, CampusHero } from "../components/CampusHero";
import { TelegramHelpCard } from "../components/TelegramHelpCard";
import "../../styles/portal-home.css";

export default function HomePage() {
  const [cargando, setCargando] = useState(true);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [faq, setFaq] = useState<Faq[]>([]);
  useEffect(() => {
    cargarResumenPortal().then(data => {
      setComunicados(data.comunicados.slice(0, 3));
      setFaq(data.faq.slice(0, 4));
    }).finally(() => setCargando(false));
  }, []);
  return <div>
    <div className="portal-home"><CampusHero /></div>
    {cargando ? <LoadingSpinner /> : <>
      <section className="container-public py-16">
        <div className="mb-8 flex items-end justify-between"><div><h2 className="text-2xl font-bold text-slate-800">Últimos comunicados</h2><p className="text-sm text-slate-500">Mantente al día con la información oficial</p></div><Link to="/comunicados" className="text-sm font-semibold text-primary-700 hover:underline">Ver todos →</Link></div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{comunicados.map(c => <ComunicadoCard key={c.idComunicado} comunicado={c} />)}</div>
      </section>
      <section className="portal-faq-section py-16"><div className="container-public">
        <div className="mb-8 flex items-end justify-between"><div><h2 className="text-2xl font-bold text-slate-800">Preguntas frecuentes</h2><p className="text-sm text-slate-500">Resuelve tus dudas más comunes</p></div><Link to="/faq" className="text-sm font-semibold text-primary-700 hover:underline">Ver todas →</Link></div>
        <div className="grid gap-3 lg:grid-cols-2">{faq.map(f => <FaqAccordionItem key={f.idFaq} faq={f} />)}</div>
        <div className="mt-8"><TelegramHelpCard /></div>
      </div></section>
      <section className="portal-attention py-16 text-white"><div className="container-public grid gap-8 lg:grid-cols-3">
        <div><h2 className="mb-2 text-2xl font-bold">Atención Kardex</h2><p className="text-primary-100">Consulta la información de contacto y horarios de atención, o genera tu ficha de atención en línea.</p><Link to="/atencion" className="btn-primary portal-button-light mt-4 inline-flex">Ir a Atención Kardex</Link></div>
        <div><h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary-300">Horario</h3><p className="text-primary-100">Lunes a viernes, 8:00 - 16:00</p></div>
        <div><h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary-300">Ubicación</h3><p className="text-primary-100">Bloque C, planta baja — Carrera de Informática</p></div>
      </div></section>
    </>}
    <div className="portal-home"><div className="container-public"><CampusCredits /></div></div>
  </div>;
}
