import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Comunicado, Faq, Horario } from "../../api/types";
import { cargarResumenPortal } from "../../services/publicContent.service";
import { ComunicadoCard } from "../components/ComunicadoCard";
import { FaqAccordionItem } from "../components/FaqAccordionItem";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { DIAS_SEMANA_LABEL } from "../../utils/formatters";

export default function HomePage() {
  const [cargando, setCargando] = useState(true);
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [faq, setFaq] = useState<Faq[]>([]);

  useEffect(() => {
    cargarResumenPortal()
      .then((data) => {
        setComunicados(data.comunicados.slice(0, 3));
        setHorarios(data.horarios.slice(0, 6));
        setFaq(data.faq.slice(0, 4));
      })
      .finally(() => setCargando(false));
  }, []);

  return (
    <div>
      {/* Banner principal */}
      <section className="portal-hero text-white">
        <div className="container-public portal-hero-grid">
        <div className="portal-hero-copy">
          <h1 className="portal-title">
            Kardex
            <span>Carrera de Informática</span>
          </h1>
          <p className="portal-intro">
            Consulta comunicados, horarios, preguntas frecuentes e información
            de atención Kardex, todo en un solo lugar.
          </p>
          <div className="portal-hero-actions flex flex-wrap gap-3">
            <Link to="/atencion" className="btn-primary portal-button-light">
              Generar ficha <span aria-hidden="true">→</span>
            </Link>
            <Link to="/comunicados" className="btn-secondary portal-button-outline">
              Ver comunicados <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/horarios" className="btn-secondary portal-button-outline">
              Consultar horarios
            </Link>
          </div>
        </div>
        <div className="portal-illustration" aria-hidden="true">
          <div className="portal-orbit portal-orbit-one" />
          <div className="portal-orbit portal-orbit-two" />
          <div className="portal-brand-logo">
            <img src="/images/kardex.png" alt="" width={640} height={640} className="h-auto w-full object-contain" />
          </div>
          <div className="portal-floating-icon portal-floating-calendar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3m-10 3h3"/></svg></div>
          <div className="portal-floating-icon portal-floating-book"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v15M6 9l3 1m6 0 3-1M6 13l3 1m6 0 3-1"/></svg></div>
        </div>
        </div>
      </section>

      {cargando ? (
        <LoadingSpinner label="Cargando información institucional..." />
      ) : (
        <>
          {/* Ultimos comunicados */}
          <section className="container-public py-16">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Últimos comunicados</h2>
                <p className="text-sm text-slate-500">Mantente al día con la información oficial</p>
              </div>
              <Link to="/comunicados" className="text-sm font-semibold text-primary-700 hover:underline">
                Ver todos →
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {comunicados.map((c) => (
                <ComunicadoCard key={c.idComunicado} comunicado={c} />
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="portal-faq-section py-16">
            <div className="container-public">
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Preguntas frecuentes</h2>
                  <p className="text-sm text-slate-500">Resuelve tus dudas más comunes</p>
                </div>
                <Link to="/faq" className="text-sm font-semibold text-primary-700 hover:underline">
                  Ver todas →
                </Link>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {faq.map((f) => (
                  <FaqAccordionItem key={f.idFaq} faq={f} />
                ))}
              </div>
            </div>
          </section>

          {/* Horarios */}
          <section className="container-public py-16">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Horarios publicados</h2>
                <p className="text-sm text-slate-500">Vista rápida de la semana académica</p>
              </div>
              <Link to="/horarios" className="text-sm font-semibold text-primary-700 hover:underline">
                Ver calendario completo →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] overflow-hidden rounded-xl border border-slate-200 text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Día</th>
                    <th className="px-4 py-3 font-semibold">Materia</th>
                    <th className="px-4 py-3 font-semibold">Docente</th>
                    <th className="px-4 py-3 font-semibold">Aula</th>
                    <th className="px-4 py-3 font-semibold">Horario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {horarios.map((h) => (
                    <tr key={h.idHorario}>
                      <td className="px-4 py-3 text-slate-500">{DIAS_SEMANA_LABEL[h.dia]}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{h.materia}</td>
                      <td className="px-4 py-3 text-slate-500">{h.docente}</td>
                      <td className="px-4 py-3 text-slate-500">{h.aula}</td>
                      <td className="px-4 py-3 text-slate-500">{h.horaInicio} - {h.horaFin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Atencion Kardex */}
          <section className="portal-attention py-16 text-white">
            <div className="container-public grid gap-8 lg:grid-cols-3">
              <div>
                <h2 className="mb-2 text-2xl font-bold">Atención Kardex</h2>
                <p className="text-primary-100">
                  Consulta la información de contacto y horarios de atención,
                  o genera tu ficha de atención en línea.
                </p>
                <Link to="/atencion" className="btn-primary portal-button-light mt-4 inline-flex">
                  Ir a Atención Kardex
                </Link>
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary-300">Horario</p>
                <p className="text-primary-100">Lunes a viernes, 8:00 - 16:00</p>
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-primary-300">Ubicación</p>
                <p className="text-primary-100">Bloque C, planta baja — Carrera de Informática</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
