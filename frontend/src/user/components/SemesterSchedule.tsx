import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUserAuthStore } from "../../store/userAuthStore";
import { useBoliviaDate } from "../../hooks/useBoliviaDate";
import { DAYS, readPlanner, ScheduleVersion, storageKey } from "../schedule/planner";

export function SemesterSchedule() {
  const userId = useUserAuthStore(s => s.usuario?.idUsuario);
  const [chosen, setChosen] = useState<ScheduleVersion | null>(null);
  const [error, setError] = useState(false);
  const today = useBoliviaDate();
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      try { const planner = readPlanner(window.localStorage, userId); setChosen(planner.versions.find(v => v.id === planner.preferredId) ?? null); setError(false); }
      catch { setChosen(null); setError(true); }
    };
    const onStorage = (event: StorageEvent) => { if (event.key === storageKey(userId) || event.key === null) refresh(); };
    refresh(); window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);
  if (error) return <p className="text-sm text-slate-500">No pudimos leer tu horario guardado. <Link className="underline" to="/usuario/arma-tu-horario">Revisar mis horarios</Link></p>;
  if (!chosen) return null;
  const day = DAYS[new Date(`${today}T12:00:00-04:00`).getUTCDay() - 1];
  const period = chosen.context?.period;
  const current = !!period && today >= period.desde && today <= period.hasta;
  const lessons = current ? chosen.lessons.filter(h => h.dia === day).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)) : [];
  return <section className="card p-6" aria-label="Mi horario del semestre">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-800">Mi horario · {period?.nombre ?? chosen.name}</h2><p className="mt-1 text-sm text-slate-500">{chosen.name} · Planificación personal guardada en este navegador.</p></div><Link to="/usuario/arma-tu-horario" className="btn-secondary">Abrir mi horario →</Link></div>
    <div className="mt-5 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-700">{current ? new Intl.DateTimeFormat("es-BO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/La_Paz" }).format(new Date(`${today}T12:00:00-04:00`)) : "Periodo guardado"}</h3>
      {!current ? <p className="mt-2 text-sm text-slate-500">{period && today < period.desde ? "Este periodo todavía no comienza. Tu planificación está guardada." : "Este periodo ya finalizó. Elige tu horario para el nuevo semestre."}</p> : lessons.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lessons.map(h => <li key={h.idHorario} className="rounded-lg bg-slate-50 p-4"><p className="text-sm font-semibold text-emerald-700">{h.horaInicio} – {h.horaFin}</p><p className="mt-1 text-sm font-bold text-slate-800">{h.materia}</p>{(h.aula || h.grupo) && <p className="mt-1 text-xs text-slate-500">{[h.aula, h.grupo && `Grupo ${h.grupo}`].filter(Boolean).join(" · ")}</p>}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No tienes clases planificadas para hoy.</p>}
    </div>
  </section>;
}
