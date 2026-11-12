import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auxiliarCarnetApi } from '../../api/auxiliar-carnet.api';
import { LUGARES, pisoLabel } from '../../api/academico.api';
import { AuxiliarCarnetModal } from '../../components/AuxiliarCarnetModal';
import { usePolling } from '../../hooks/usePolling';
import { LoadingSpinner } from '../../public-site/components/LoadingSpinner';
import { SolicitudesAulasPanel } from './SolicitudesAulasPage';

const dias: Record<string, string> = { LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado' };
const fecha = (value: string) => value.split('-').reverse().join('/');

export default function MiAuxiliaturaPage() {
  const load = useCallback(() => auxiliarCarnetApi.miAuxiliatura(), []);
  const { data, loading, error, refresh, updatedAt } = usePolling(load, 30000);
  const [params, setParams] = useSearchParams();
  const [carnet, setCarnet] = useState(false);
  const asignaciones = data?.perfil.asignaciones ?? [];
  const solicitada = params.get('asignacion') || '';
  const seleccion = solicitada || (asignaciones.length === 1 ? asignaciones[0].idAsignacion : '');
  const actual = asignaciones.find(a => a.idAsignacion === seleccion);
  const horarios = data?.horarios.filter(h => h.idAsignacion === actual?.idAsignacion) ?? [];
  function elegir(id: string) {
    setCarnet(false);
    setParams(id ? { asignacion: id } : {});
  }
  return <div className="container-public space-y-6 py-8">
    <div className="rounded-2xl bg-emerald-900 p-6 text-white">
      <p className="text-xs uppercase tracking-widest text-emerald-200">Kardex · Auxiliar de docencia</p>
      <h1 className="mt-2 text-3xl font-bold">Mi auxiliatura</h1>
      <p className="mt-3 text-sm leading-6 text-emerald-50">Tus materias, horarios, carnet y solicitudes de aula en un solo lugar.</p>
    </div>
    {loading ? <LoadingSpinner label="Consultando tu auxiliatura…" /> : error ?
      <div role="alert" className="rounded-xl bg-amber-50 p-5 text-amber-900"><p>{error}</p><button className="btn-secondary mt-3" onClick={refresh}>Reintentar</button></div> :
      !data?.perfil.habilitado ? <section className="card p-6"><h2 className="text-xl font-bold">No tienes una auxiliatura habilitada</h2><p className="mt-2 text-slate-600">Si ya fuiste designado, solicita a Kardex que vincule tu cuenta con la materia y el docente.</p></section> : <>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold text-slate-800">{data.perfil.datos?.nombre}</p><button className="btn-secondary" onClick={refresh}>Actualizar mi auxiliatura</button></div>
        {data.horarios.some(h => h.aulaOriginal) && <section role="status" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Avisos de cambio de aula por un día</h2>{data.horarios.filter(h => h.aulaOriginal).map(h => <p key={h.id} className="text-sm text-amber-950">El {fecha(h.fecha!)} tu aula {h.aulaOriginal} será ocupada por {h.docenteReserva || 'un docente'}. Debes pasar <strong>en {h.aula}, de {h.horaInicio} a {h.horaFin}</strong> ({h.materia}). Tu aula {h.aulaOriginal} se mantiene para las demás fechas del semestre.</p>)}</section>}
        {(asignaciones.length > 1 || solicitada && !actual) && <section className="card p-5">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="materia-auxiliatura">Selecciona tu materia</label>
          <select id="materia-auxiliatura" className="select-field mt-2" value={actual?.idAsignacion ?? ''} onChange={e => elegir(e.target.value)}>
            <option value="">Elige una materia para ver tu auxiliatura</option>
            {asignaciones.map(a => <option key={a.idAsignacion} value={a.idAsignacion}>{a.siglas.join(' / ')} · {a.materia} · Paralelo {a.grupo} · {a.periodo} · {a.docente}</option>)}
          </select>
          {solicitada && !actual && <p role="status" className="mt-3 text-sm text-amber-800">Esta asignación ya no está disponible. Selecciona una materia vigente.</p>}
        </section>}
        {!asignaciones.length ? <section className="card p-6"><h2 className="text-xl font-bold">Sin materias vigentes</h2><p className="mt-2 text-slate-600">Tu cuenta está habilitada, pero todavía no tiene materias vinculadas en un periodo vigente. Consulta con Kardex.</p></section> : !actual ?
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Elige una materia para ver sus horarios, tu carnet y las solicitudes relacionadas.</p> : <>
            <section className="card p-6" aria-label="Datos de mi materia">
              <p className="text-xs font-semibold text-emerald-700">{actual.siglas.join(' / ')}</p><h2 className="mt-1 text-2xl font-bold text-slate-800">{actual.materia}</h2>
              <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
                <div><dt className="text-slate-500">Docente titular</dt><dd className="mt-1 font-semibold">{actual.docente}</dd></div>
                <div><dt className="text-slate-500">Paralelo y periodo</dt><dd className="mt-1 font-semibold">{actual.grupo} · {actual.periodo}</dd></div>
                <div><dt className="text-slate-500">Vigencia</dt><dd className="mt-1 font-semibold">{fecha(actual.desde)} – {fecha(actual.hasta)}</dd></div>
              </dl>
            </section>
            <section className="space-y-3" aria-label="Horarios de mi materia"><h2 className="text-xl font-bold text-slate-800">Mis aulas y horarios</h2>
              {!horarios.length ? <p className="card p-6 text-sm text-slate-600">Aún no tienes horarios ni reservas confirmadas para esta materia. Puedes enviar una solicitud de aula más abajo.</p> :
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{horarios.map(h => <article key={h.id} className="card p-5">
                  <p className="text-xs font-semibold text-emerald-700">{h.fecha ? `Reserva · ${fecha(h.fecha)}` : 'Horario semanal'}</p>
                  <h3 className="mt-2 text-2xl font-bold text-emerald-900">Aula {h.aula}</h3>
                  <p className="mt-2 font-semibold">{dias[h.dia] || h.dia} · {h.horaInicio} – {h.horaFin}</p>
                  <p className="mt-2 text-sm text-slate-500">{LUGARES[h.lugar] || h.lugar} · {pisoLabel(h.piso)}</p>
                  {h.traslados?.map(t => <p key={t.fecha} className="mt-2 text-sm text-amber-800">Solo el {fecha(t.fecha)}: pasar en {t.aula}. Las demás fechas se mantienen aquí.</p>)}
                </article>)}</div>}
              <p className="text-xs text-slate-500">Hora de Bolivia. Actualización automática cada 30 segundos{updatedAt ? ` · Última consulta: ${updatedAt.toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz' })}` : ''}.</p>
            </section>
          </>}
        {(actual || !asignaciones.length) && <section className="card flex flex-wrap items-center justify-between gap-4 p-6" aria-label="Mi carnet">
          <div><h2 className="text-xl font-bold text-slate-800">Mi carnet de auxiliar</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">Tu carnet es personal y válido para todas tus materias. Descárgalo o imprímelo; su QR muestra tus asignaciones actualizadas.</p></div>
          <button type="button" className="btn-primary" onClick={() => setCarnet(true)}>Ver mi carnet y QR</button>
        </section>}
        {actual && <section className="border-t border-slate-200 pt-6"><SolicitudesAulasPanel key={actual.idAsignacion} idAsignacion={actual.idAsignacion} /></section>}
        {carnet && <AuxiliarCarnetModal propio onClose={() => setCarnet(false)} />}
      </>}
    <div className="flex flex-wrap gap-5 text-sm"><Link className="text-emerald-700 underline" to="/usuario/dashboard">Volver a mi inicio</Link><Link className="text-emerald-700 underline" to="/usuario/solicitudes-aulas">Ver todas mis solicitudes de aulas</Link></div>
  </div>;
}
