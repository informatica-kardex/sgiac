import { FormEvent, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { auditApi, AuditEvent, AuditFilters, AuditList, AuditParams } from '../../api/audit.api';
import { AdminIcon } from '../components/AdminIcon';
import { ErrorNotice } from '../components/AcademicoUI';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';

const emptyFilters = { q: '', tipo: '', resultado: '', entidad: '', accion: '', usuario: '', registro: '', desde: '', hasta: '' };
const kinds: Record<string, string> = { ACCESO: 'Accesos y seguridad', MODIFICACION: 'Modificaciones', CONSULTA: 'Consultas', EXPORTACION: 'Descargas y exportaciones', SISTEMA: 'Sistema' };
const results: Record<string, string> = { EXITO: 'Exitoso', RECHAZADO: 'Rechazado', ERROR: 'Error' };
const dateFormat = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/La_Paz' });
const humanize = (value: string) => value.replace(/_/g, ' ').toLowerCase();
function detailObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function summary(event: AuditEvent) {
  const detail = detailObject(event.detalle);
  return text(detail.descripcion) || text(detailObject(detail.respuesta).message) || text(event.detalle) || text(detail.ruta) || 'Operación registrada';
}
function errorMessage(error: unknown) {
  return isAxiosError(error) ? error.response?.data?.message || 'No se pudo conectar con el servidor.' : 'No se pudo completar la operación.';
}
function ResultBadge({ result }: { result: string }) {
  return <span className={`badge ${result === 'ERROR' ? 'bg-red-50 text-red-700' : result === 'RECHAZADO' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{results[result] || result}</span>;
}

export default function AuditPage() {
  const [form, setForm] = useState(emptyFilters);
  const [params, setParams] = useState<AuditParams>({});
  const [filters, setFilters] = useState<AuditFilters>({ acciones: [], entidades: [], usuarios: [] });
  const [page, setPage] = useState(1), [limit, setLimit] = useState(25), [revision, setRevision] = useState(0);
  const [data, setData] = useState<AuditList | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const [selected, setSelected] = useState<string | null>(null), [event, setEvent] = useState<AuditEvent | null>(null);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    auditApi.list({ ...params, pagina: page, limite: limit }, controller.signal)
      .then(value => {
        if (controller.signal.aborted) return;
        if (page > Math.max(1, value.paginas)) { setPage(Math.max(1, value.paginas)); return; }
        setData(value);
      })
      .catch(e => { if (!controller.signal.aborted) { setError(errorMessage(e)); setData(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [params, page, limit, revision]);

  useEffect(() => {
    const controller = new AbortController();
    auditApi.filters(controller.signal).then(value => { if (!controller.signal.aborted) { setFilters(value); setFilterError(''); } })
      .catch(() => { if (!controller.signal.aborted) setFilterError('No se pudieron cargar las opciones de filtros. Puedes buscar por texto o volver a actualizar.'); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setEvent(null); setDetailError('');
    auditApi.detail(selected, controller.signal).then(value => { if (!controller.signal.aborted) setEvent(value); })
      .catch(e => { if (!controller.signal.aborted) setDetailError(errorMessage(e)); });
    return () => controller.abort();
  }, [selected]);

  function apply(e: FormEvent) {
    e.preventDefault();
    if (form.desde && form.hasta && form.desde > form.hasta) { setError('La fecha inicial no puede ser posterior a la final.'); return; }
    const next: AuditParams = {};
    Object.entries(form).forEach(([key, value]) => { if (value.trim() && key !== 'desde' && key !== 'hasta') next[key] = value.trim(); });
    if (form.desde) next.desde = new Date(`${form.desde}T00:00:00-04:00`).toISOString();
    if (form.hasta) next.hasta = new Date(new Date(`${form.hasta}T00:00:00-04:00`).getTime() + 86400000).toISOString();
    setPage(1); setParams(next); setExportError('');
  }

  async function exportCsv() {
    setExporting(true); setExportError('');
    try {
      const blob = await auditApi.export(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'auditoria.csv';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      let message = errorMessage(e);
      if (isAxiosError(e) && e.response?.data instanceof Blob) {
        try { message = JSON.parse(await e.response.data.text()).message || message; } catch { /* Error de red o respuesta no JSON. */ }
      }
      setExportError(message);
    } finally { setExporting(false); }
  }

  const detail = detailObject(event?.detalle);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-bold">Bitácora de auditoría</h1><p className="text-sm text-slate-500">Historial de accesos, operaciones, consultas y errores del sistema.</p></div>
      <div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={loading} onClick={() => setRevision(n => n + 1)}>Actualizar</button><button className="btn-primary" disabled={exporting || loading || !data?.total || Boolean(error)} onClick={() => void exportCsv()}><AdminIcon name="auditoria" size={16} />{exporting ? 'Exportando…' : 'Exportar CSV'}</button></div>
    </div>
    <form onSubmit={apply} className="card space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs text-slate-600"><span>Buscar evento</span><input className="input-field" type="search" maxLength={150} placeholder="Usuario, acción, detalle o ID…" value={form.q} onChange={e => setForm({ ...form, q: e.target.value })} /></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Tipo de operación</span><select className="select-field" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option value="">Todos los tipos</option>{Object.entries(kinds).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Resultado</span><select className="select-field" value={form.resultado} onChange={e => setForm({ ...form, resultado: e.target.value })}><option value="">Todos los resultados</option>{Object.entries(results).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Usuario responsable</span><select className="select-field" value={form.usuario} onChange={e => setForm({ ...form, usuario: e.target.value })}><option value="">Todos los usuarios</option>{filters.usuarios.map(u => <option key={u.idUsuario} value={u.idUsuario}>{u.nombreCompleto} · {u.correo}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Entidad / módulo</span><select className="select-field" value={form.entidad} onChange={e => setForm({ ...form, entidad: e.target.value })}><option value="">Todas las entidades</option>{filters.entidades.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Acción específica</span><select className="select-field" value={form.accion} onChange={e => setForm({ ...form, accion: e.target.value })}><option value="">Todas las acciones</option>{filters.acciones.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Desde (Bolivia)</span><input className="input-field" type="date" max="9999-12-30" value={form.desde} onChange={e => setForm({ ...form, desde: e.target.value })} /></label>
        <label className="space-y-1 text-xs text-slate-600"><span>Hasta (inclusive, Bolivia)</span><input className="input-field" type="date" min={form.desde || undefined} max="9999-12-30" value={form.hasta} onChange={e => setForm({ ...form, hasta: e.target.value })} /></label>
      </div>
      <details><summary className="cursor-pointer text-xs text-slate-600">Buscar un registro afectado</summary><label className="mt-2 block max-w-sm text-xs text-slate-600">ID del registro<input className="input-field mt-1" value={form.registro} maxLength={100} onChange={e => setForm({ ...form, registro: e.target.value })} /></label></details>
      <div className="flex flex-wrap items-center gap-3"><button className="btn-primary" type="submit">Aplicar filtros</button><button className="btn-secondary" type="button" onClick={() => { setForm(emptyFilters); setParams({}); setPage(1); setExportError(''); }}>Limpiar filtros</button><span className="text-xs text-slate-500">La exportación incluye todos los resultados filtrados, hasta 10.000 eventos.</span></div>
    </form>
    <ErrorNotice message={filterError} /><ErrorNotice message={exportError} /><ErrorNotice message={error} retry={() => setRevision(n => n + 1)} />
    {loading ? <LoadingSpinner label="Cargando auditoría…" /> : data && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Eventos encontrados', data.total], ['Exitosos', data.resumen.exitosos], ['Rechazados', data.resumen.rechazados], ['Errores', data.resumen.errores]].map(([label, value]) => <div className="card p-4" key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>
      <section className="card overflow-hidden" aria-label="Eventos de auditoría">
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead><tr>{['Fecha y hora (Bolivia)', 'Operación', 'Entidad / registro', 'Detalle', 'Usuario', 'Resultado', 'Acciones'].map(title => <th key={title} scope="col" className="px-4 py-3">{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{data.eventos.map(item => <tr key={item.idBitacora}>
            <td className="whitespace-nowrap px-4 py-4 text-slate-500">{dateFormat.format(new Date(item.fechaHora))}<span className="mt-1 block text-[10px]">#{item.idBitacora}</span></td>
            <td className="max-w-[240px] px-4 py-4"><span className="font-semibold">{kinds[item.tipo] || item.tipo}</span><span className="mt-1 block break-words text-slate-500">{humanize(item.accion)}</span></td>
            <td className="px-4 py-4">{humanize(item.entidadAfectada)}{item.idRegistroAfectado && <span className="mt-1 block text-slate-500">#{item.idRegistroAfectado}</span>}</td>
            <td className="max-w-xs break-words px-4 py-4 text-slate-600">{summary(item)}</td>
            <td className="px-4 py-4"><span className="font-medium">{item.usuario?.nombreCompleto || (item.idUsuario ? `Usuario #${item.idUsuario}` : 'Sin sesión / sistema')}</span><span className="mt-1 block text-slate-500">{item.usuario?.correo}</span></td>
            <td className="px-4 py-4"><ResultBadge result={item.resultado} /></td>
            <td className="px-4 py-4"><button className="btn-ghost" aria-label={`Ver detalle del evento ${item.idBitacora}`} onClick={() => setSelected(item.idBitacora)}>Ver detalle</button></td>
          </tr>)}{!data.eventos.length && <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-500">No hay eventos que coincidan con los filtros.</td></tr>}</tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-500"><p aria-live="polite">{data.total ? `${(page - 1) * limit + 1}–${Math.min(page * limit, data.total)} de ${data.total} eventos` : '0 eventos'} · Solo lectura</p><div className="flex flex-wrap items-center gap-3"><label>Por página <select className="rounded border border-slate-200 p-1" value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Anterior</button><span>Página {page} de {Math.max(1, data.paginas)}</span><button className="btn-secondary" disabled={page >= data.paginas} onClick={() => setPage(n => n + 1)}>Siguiente</button></div></div>
      </section>
    </>}
    <p className="text-xs text-slate-500">Se conservan los registros históricos disponibles. El registro ampliado comienza con esta versión; no reconstruye operaciones anteriores que no fueron registradas. Se omiten latidos automáticos y el listado de la propia bitácora.</p>
    <Modal title={`Evento de auditoría #${selected ?? ''}`} open={Boolean(selected)} onClose={() => setSelected(null)} size="wide">
      {detailError ? <ErrorNotice message={detailError} /> : !event ? <LoadingSpinner label="Cargando evento…" /> : <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{humanize(event.accion)}</span><ResultBadge result={event.resultado} /></div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">{[
          ['Fecha (Bolivia)', dateFormat.format(new Date(event.fechaHora))], ['Fecha UTC', new Date(event.fechaHora).toISOString()],
          ['Usuario', event.usuario ? `${event.usuario.nombreCompleto} (${event.usuario.correo})` : text(detailObject(detail.actor).correo) || 'Sin sesión / sistema'],
          ['Entidad y registro', `${event.entidadAfectada}${event.idRegistroAfectado ? ` #${event.idRegistroAfectado}` : ''}`],
          ['Dirección IP', text(detail.ip) || 'No registrada'], ['Respuesta HTTP', text(detail.estadoHttp) || 'Evento interno'],
          ['Solicitud', `${text(detail.metodo)} ${text(detail.ruta)}`.trim() || 'No registrada'], ['Duración', detail.duracionMs !== undefined ? `${text(detail.duracionMs)} ms` : 'No registrada'],
          ['Identificador de solicitud', text(detail.requestId) || 'No registrado'], ['Navegador', text(detail.navegador) || 'No registrado'],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>
        <div><h3 className="mb-2 text-sm font-semibold">Datos de la operación</h3><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4 text-xs">{JSON.stringify(event.detalle, null, 2) || 'Sin detalle adicional'}</pre></div>
        <p className="text-xs text-slate-500">Los campos de credenciales y códigos privados se muestran como [PROTEGIDO]. Los datos extensos pueden aparecer truncados.</p>
      </div>}
    </Modal>
  </div>;
}
