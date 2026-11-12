import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { auxiliarCarnetApi, HorarioCarnet } from '../../api/auxiliar-carnet.api';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { usePolling } from '../../hooks/usePolling';

const DIAS: Record<string, string> = { LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado' };
const fecha = (value: string) => new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/La_Paz' }).format(new Date(`${value}T12:00:00Z`));

function Horario({ horario: h }: { horario: HorarioCarnet }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="break-words text-2xl font-bold text-emerald-900">Aula {h.aula}</h3>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{h.fecha ? 'Reserva por fecha' : 'Horario semanal'}</span>
    </div>
    <p className="mt-3 text-lg font-semibold text-slate-900">{DIAS[h.dia] || h.dia}{h.fecha ? ` · ${fecha(h.fecha)}` : ''}</p>
    <p className="text-2xl font-bold tabular-nums text-slate-900">{h.horaInicio} – {h.horaFin}</p>
    <p className="mt-3 text-sm text-slate-600">{LUGARES[h.lugar] || h.lugar} · {pisoLabel(h.piso)}</p>
    <p className="mt-3 break-words font-semibold text-slate-800">{h.materia}</p>
    <p className="text-sm text-slate-500">Paralelo {h.grupo} · {h.periodo}</p>
    {!h.fecha && <p className="mt-2 text-xs text-slate-500">Del {fecha(h.desde)} al {fecha(h.hasta)}</p>}
    {h.aulaOriginal && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Traslado solo por este día: {h.docenteReserva || 'un docente'} ocupará {h.aulaOriginal}. Debes pasar en {h.aula}. Las demás fechas vuelves a {h.aulaOriginal}.</p>}
    {h.traslados?.map(t => <p key={t.fecha} className="mt-2 text-sm text-amber-800">Excepto el {fecha(t.fecha)}: debes pasar en {t.aula}.</p>)}
  </article>;
}

export default function AuxiliarHorarioPage() {
  const { token = '' } = useParams();
  const load = useCallback(() => auxiliarCarnetApi.consultar(token), [token]);
  const { data, loading, error, refresh, updatedAt } = usePolling(load, 30000);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Aula y horario del auxiliar · SGIAC';
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex, nofollow, noarchive';
    const referrer = document.createElement('meta'); referrer.name = 'referrer'; referrer.content = 'no-referrer';
    document.head.append(robots, referrer);
    return () => { document.title = previous; robots.remove(); referrer.remove(); };
  }, []);
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-800 sm:py-12">
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">UMSA · Carrera de Informática</p>
        <h1 className="mt-3 text-3xl font-bold">Aula y horario</h1>
        {data && !error && <p className="mt-2 break-words text-lg">{data.nombreCompleto}<span className="block text-sm text-slate-500">Auxiliar de docencia</span></p>}
      </header>
      {loading ? <p role="status" className="rounded-xl bg-white p-5">Consultando la asignación actual…</p> : error ?
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><p>{error}</p><p className="mt-2 text-sm">No se puede confirmar la asignación actual. Reintenta o consulta con Kardex.</p></div> :
        data && <>
          {data.horarios.length ? <div className="space-y-4">{data.horarios.map(h => <Horario key={h.id} horario={h} />)}</div> :
            <div className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Sin horarios asignados</h2><p className="mt-2 text-sm text-slate-600">Todavía no hay aulas ni reservas vigentes publicadas para este auxiliar. Consulta con Kardex.</p></div>}
          <p className="text-xs text-slate-500">{updatedAt && `Consultado a las ${updatedAt.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit', second: '2-digit' })}. `}Hora de Bolivia (UTC−4). Se actualiza automáticamente cada 30 segundos.</p>
        </>}
      <button type="button" className="w-full rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-50" disabled={loading} onClick={refresh}>{error ? 'Reintentar' : 'Actualizar horario'}</button>
      <p className="text-center text-xs text-slate-500">Los cambios de aula y horario se consultan con el mismo QR.</p>
    </div>
  </main>;
}
