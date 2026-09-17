import { useEffect, useState } from "react";
import { faqApi } from "../../api/faq.api";
import { Faq } from "../../api/types";
import { FaqAccordionItem } from "../components/FaqAccordionItem";
import { LoadingSpinner } from "../components/LoadingSpinner";

const CATEGORIA_TODAS = "Todas";

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [cargando, setCargando] = useState(true);
  const [categoria, setCategoria] = useState(CATEGORIA_TODAS);

  useEffect(() => {
    faqApi
      .listar()
      .then(({ data }) => setFaqs(data.data))
      .finally(() => setCargando(false));
  }, []);

  const categorias = [CATEGORIA_TODAS, ...Array.from(new Set(faqs.map((f) => f.categoria)))];
  const filtradas =
    categoria === CATEGORIA_TODAS ? faqs : faqs.filter((f) => f.categoria === categoria);

  return (
    <div className="container-public py-14">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800">Preguntas frecuentes</h1>
        <p className="mt-1 text-slate-500">
          Encuentra respuestas rápidas sobre matrícula, kardex, horarios y más.
        </p>
      </div>

      {!cargando && (
        <div className="mb-8 flex flex-wrap gap-2">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                categoria === cat
                  ? "bg-primary-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {cargando ? (
        <LoadingSpinner label="Cargando preguntas frecuentes..." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtradas.map((f) => (
            <FaqAccordionItem key={f.idFaq} faq={f} />
          ))}
        </div>
      )}
    </div>
  );
}
