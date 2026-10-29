import { useEffect, useState } from "react";
import { faqApi } from "../../api/faq.api";
import { Faq } from "../../api/types";
import { FaqAccordionItem } from "../components/FaqAccordionItem";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { TelegramHelpCard } from "../components/TelegramHelpCard";

const CATEGORIA_TODAS = "Todas";
export default function FaqPage() {
  const [faq, setFaq] = useState<Faq[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [categoria, setCategoria] = useState(CATEGORIA_TODAS);
  useEffect(() => {
    faqApi.listar().then(({ data }) => setFaq(data.data)).catch(() => setError(true)).finally(() => setCargando(false));
  }, []);
  const categorias = [CATEGORIA_TODAS, ...new Set(faq.map(f => f.categoria))];
  const filtradas = categoria === CATEGORIA_TODAS ? faq : faq.filter(f => f.categoria === categoria);
  return <div className="container-public py-14">
    <div className="mb-8"><h1 className="text-3xl font-extrabold text-slate-800">Preguntas frecuentes</h1><p className="mt-1 text-slate-500">Encuentra respuestas rápidas sobre matrícula, kardex, horarios y más.</p></div>
    <div className="mb-8"><TelegramHelpCard /></div>
    {!cargando && !error && <div className="mb-8 flex flex-wrap gap-2">{categorias.map(c => <button key={c} onClick={() => setCategoria(c)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${categoria === c ? "bg-primary-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{c}</button>)}</div>}
    {cargando ? <LoadingSpinner label="Cargando preguntas frecuentes..." /> : error ? <p role="alert" className="text-sm text-slate-600">No se pudieron cargar las preguntas. Vuelve a intentarlo recargando la página.</p> : !filtradas.length ? <p className="text-slate-500">Todavía no hay preguntas publicadas en esta categoría.</p> : <div className="grid gap-3 lg:grid-cols-2">{filtradas.map(f => <FaqAccordionItem key={f.idFaq} faq={f} />)}</div>}
  </div>;
}
