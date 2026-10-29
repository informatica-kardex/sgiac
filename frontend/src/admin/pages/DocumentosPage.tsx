import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AccionDocumento, ConfigDocumento, documentosApi, ESTADOS_DOCUMENTO, EstadoDocumento, SolicitudDocumento, TipoDocumento } from "../../api/documentos.api";
import { fechaDesdeBolivia, fechaDocumento, fechaInputBolivia, nombrePorApellido } from "../../components/DocumentoDetalle";
import { mensajeError, usePolling } from "../../hooks/usePolling";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { Modal } from "../components/Modal";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { DocumentoGestion } from "../components/DocumentoGestion";
import { sugerirIdentificador } from "../../utils/fichaIdentificador";

const configInicial: ConfigDocumento = { nombre: "", identificador: "", descripcion: "", habilitado: false, desde: null, hasta: null, plazoHoras: 48, demoraRecojoMinutos: 60, cupoDiario: 50, lugar: "Kardex", requisitos: "Presenta tu identificación y tu ficha. Trae hojas blancas tamaño carta.", correoHabilitado: true, horaInicio: "08:00", horaFin: "16:00", diasAtencion: [1, 2, 3, 4, 5] };

export default function DocumentosPage() {
  const { usuario } = useAdminAuth();
  const esAdmin = usuario?.roles.includes("ADMINISTRADOR");
  const [tab, setTab] = useState<"bandeja" | "config">("bandeja");
  const [filtro, setFiltro] = useState<{ estado?: string; q: string; pagina: number }>({ q: "", pagina: 1 });
  const [busqueda, setBusqueda] = useState("");
  const load = useCallback(async () => (await documentosApi.bandeja(filtro)).data.data, [filtro]);
  const { data, loading, error: loadError, refresh } = usePolling(load, 30000);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [responsables, setResponsables] = useState<{ id: string; nombre: string }[]>([]);
  const [catalogoError, setCatalogoError] = useState("");
  const [catalogoLoading, setCatalogoLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [config, setConfig] = useState<{ id: string | null; value: ConfigDocumento } | null>(null);
  const [editor, setEditor] = useState<SolicitudDocumento | null>(null);
  const [identificadorManual, setIdentificadorManual] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    setCatalogoError(""); setCatalogoLoading(true);
    try { const [t, r] = await Promise.all([documentosApi.tipos(), documentosApi.responsables()]); setTipos(t.data.data); setResponsables(r.data.data); }
    catch (e) { setCatalogoError(mensajeError(e)); }
    finally { setCatalogoLoading(false); }
  }, []);
  useEffect(() => { void cargarCatalogo(); }, [cargarCatalogo]);
  async function operar(fn: () => Promise<unknown>, mensaje: string, cerrar = true) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setSuccess("");
    try { await fn(); setSuccess(mensaje); if (cerrar) { setEditor(null); setConfig(null); } refresh(); }
    catch (e) { setError(mensajeError(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  function gestionar(accion: Omit<AccionDocumento, "version">) {
    if (!editor) return;
    const cerrar = !["PREPARAR", "ASIGNAR"].includes(accion.accion);
    void operar(async () => {
      const response = await documentosApi.accion(editor.id, { ...accion, version: editor.version });
      if (!cerrar) setEditor(response.data.data);
    }, accion.accion === "LISTA" ? "Documento listo. Hora de recojo confirmada y avisos programados." : "Solicitud actualizada.", cerrar);
  }
  function guardarConfig(e: FormEvent) {
    e.preventDefault(); if (!config) return;
    if ((config.value.desde === null) !== (config.value.hasta === null) || (config.value.desde && config.value.hasta && config.value.hasta <= config.value.desde)) { setError("Indica inicio y cierre, con el cierre posterior al inicio."); return; }
    if (!config.value.diasAtencion.length || config.value.horaFin <= config.value.horaInicio) { setError("Selecciona al menos un día y un horario de cierre posterior a la apertura."); return; }
    void operar(async () => { await documentosApi.guardarTipo(config.id, config.value); await cargarCatalogo(); }, "Configuración guardada. Los cambios se aplican a las nuevas solicitudes.");
  }
  const cambiarConfig = (value: Partial<ConfigDocumento>) => setConfig(c => c && { ...c, value: { ...c.value, ...value,
    ...(!c.id && !identificadorManual && value.nombre !== undefined ? { identificador: sugerirIdentificador(value.nombre, tipos.map(t => t.identificador)) } : {}),
  } });
  const actual = editor && data?.solicitudes.find(s => s.id === editor.id);
  const vencida = !!editor && !!actual && actual.version > editor.version;
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Atención diferida · Kardex</p><h1 className="mt-2 text-2xl font-bold text-slate-800">Solicitudes de documentos</h1><p className="mt-2 max-w-3xl text-sm text-slate-500">Recibe solicitudes, prepara los documentos y organiza el recojo con una ficha. Todos los horarios corresponden a Bolivia.</p></div><button className="btn-secondary" onClick={() => { refresh(); void cargarCatalogo(); }}>Actualizar</button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{(["SOLICITADA", "EN_PREPARACION", "LISTA", "ENTREGADA"] as EstadoDocumento[]).map(estado => <button key={estado} onClick={() => { setFiltro({ q: "", estado, pagina: 1 }); setBusqueda(""); setTab("bandeja"); }} className={`rounded-xl border bg-white p-4 text-left ${filtro.estado === estado ? "border-emerald-500" : "border-slate-200"}`}><p className="text-xs text-slate-500">{ESTADOS_DOCUMENTO[estado]}</p><p className="mt-2 text-2xl font-bold text-slate-800">{data?.resumen[estado] ?? 0}</p></button>)}</div>
    <div className="flex flex-wrap gap-3"><button className={tab === "bandeja" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("bandeja")}>Bandeja de solicitudes</button><button className={tab === "config" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("config")}>Documentos y periodos</button></div>
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{success}</p>}
    {error && !editor && !config && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {loadError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{loadError} <button className="underline" onClick={refresh}>Reintentar</button></p>}
    {catalogoError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo actualizar la configuración: {catalogoError} <button className="underline" onClick={() => void cargarCatalogo()}>Reintentar</button></p>}
    {tab === "bandeja" ? <>
      <form className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={e => { e.preventDefault(); setFiltro({ ...filtro, q: busqueda.trim(), pagina: 1 }); }}>
        <label className="min-w-0 text-sm font-semibold">Buscar ficha o estudiante<input className="input-field mt-2" placeholder="CI, apellidos, nombre o código de ficha" value={busqueda} maxLength={120} onChange={e => setBusqueda(e.target.value)} /></label>
        <label className="text-sm font-semibold">Estado<select className="select-field mt-2 w-full" value={filtro.estado ?? ""} onChange={e => setFiltro({ ...filtro, estado: e.target.value || undefined, pagina: 1 })}><option value="">Todos los estados</option>{Object.entries(ESTADOS_DOCUMENTO).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="btn-primary">Buscar</button>
      </form>
      {loading ? <LoadingSpinner /> : data && <>
        <p className="text-sm text-slate-500">{data.total} solicitudes · Ordenadas por apellidos. Pulsa un nombre para abrir.</p>
        {!data.solicitudes.length && <div className="card p-10 text-center"><h2 className="font-bold text-slate-800">No hay solicitudes en esta vista</h2><p className="mt-2 text-sm text-slate-500">Las solicitudes enviadas desde la sesión del estudiante aparecerán aquí.</p></div>}
        <ul aria-label="Solicitudes por apellidos" className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {data.solicitudes.map(s => <li key={s.id}><button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm font-semibold text-slate-800 transition hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600" disabled={busy} title={s.documento + " · " + s.codigo} onClick={() => { setError(""); setEditor(s); }}>
            <span>{nombrePorApellido(s)}</span><span aria-hidden="true" className="text-lg text-slate-400">›</span><span className="sr-only">Abrir {s.documento}, ficha {s.codigo}</span>
          </button></li>)}
        </ul>
        <div className="flex items-center justify-between gap-3"><button className="btn-secondary" disabled={filtro.pagina === 1} onClick={() => setFiltro({ ...filtro, pagina: filtro.pagina - 1 })}>Anterior</button><span className="text-sm text-slate-500">Página {filtro.pagina} de {Math.max(1, Math.ceil(data.total / 30))}</span><button className="btn-secondary" disabled={filtro.pagina * 30 >= data.total} onClick={() => setFiltro({ ...filtro, pagina: filtro.pagina + 1 })}>Siguiente</button></div>
      </>}
    </> : <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-2xl text-sm text-slate-500">Configura periodos como Beca Comedor. Deshabilitar un documento cierra nuevas solicitudes y conserva las pendientes. Los cambios se aplican a solicitudes futuras; reprograma las existentes desde la bandeja.</p>{esAdmin && <button className="btn-primary" disabled={busy || catalogoLoading || !!catalogoError} onClick={() => { setError(""); setIdentificadorManual(false); setConfig({ id: null, value: { ...configInicial } }); }}>Nuevo documento</button>}</div>
      {catalogoLoading ? <LoadingSpinner /> : <div className="grid gap-4 xl:grid-cols-2">{tipos.map(t => <article key={t.id} className="card p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-800">{t.nombre}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${t.disponible ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{t.disponible ? "Recibiendo solicitudes" : t.habilitado ? "Fuera de periodo" : "Deshabilitado"}</span></div><p className="mt-3 text-sm text-slate-500">{t.descripcion}</p><dl className="mt-4 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-500">Plazo estimado</dt><dd className="font-semibold">{t.plazoHoras} horas corridas</dd></div><div><dt className="text-slate-500">Cupo diario de solicitudes</dt><dd className="font-semibold">{t.cupoDiario}</dd></div><div><dt className="text-slate-500">Identificador de fichas</dt><dd className="font-mono font-semibold">{t.identificador}</dd></div><div><dt className="text-slate-500">Correo al estar listo</dt><dd className="font-semibold">{t.correoHabilitado ? "Activado" : "Desactivado"}</dd></div></dl><p className="mt-4 text-sm text-slate-600">{t.desde ? `${fechaDocumento(t.desde)} → ${fechaDocumento(t.hasta)}` : "Sin límite de fechas"}</p><p className="mt-2 text-sm text-slate-600">{t.lugar} · {t.horaInicio} – {t.horaFin}</p>{esAdmin && <button className="btn-secondary mt-5" disabled={busy || !!catalogoError} onClick={() => { setError(""); setConfig({ id: t.id, value: { ...t } }); }}>Configurar documento</button>}</article>)}</div>}
      {!esAdmin && <p className="text-sm text-slate-500">Solo el administrador puede habilitar documentos y modificar sus periodos, plazos y requisitos.</p>}
    </section>}
    <Modal open={!!editor} title="Solicitud de documento" onClose={() => { if (!busy) { setEditor(null); setError(""); } }}>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {vencida && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">La solicitud cambió. <button className="underline" disabled={busy} onClick={() => { if (actual) { setEditor(null); setTimeout(() => setEditor(actual), 0); } }}>Actualizar detalle</button></p>}
      {editor && <DocumentoGestion key={editor.id} solicitud={editor} responsables={responsables} demora={tipos.find(t => t.id === editor.idTipo)?.demoraRecojoMinutos ?? 60} disabled={busy || vencida || !!loadError} responsablesDisabled={!!catalogoError || catalogoLoading} busy={busy} onAccion={gestionar} onReintentar={canal => void operar(() => documentosApi.reintentar(editor.id, canal), "Aviso en cola para reintento.")} />}
    </Modal>
    <Modal open={!!config} title={config?.id ? "Configurar documento y periodo" : "Nuevo documento académico"} size="wide" onClose={() => { if (!busy) { setConfig(null); setError(""); } }}>
      {config && <form onSubmit={guardarConfig}><fieldset disabled={busy} className="space-y-5">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <label className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"><input type="checkbox" checked={config.value.habilitado} onChange={e => cambiarConfig({ habilitado: e.target.checked })} />Habilitar solicitudes en la sesión del estudiante</label>
        <label className="block text-sm font-semibold">Nombre del documento<input required minLength={3} maxLength={120} className="input-field mt-2" value={config.value.nombre} onChange={e => cambiarConfig({ nombre: e.target.value })} /></label>
        <label className="block text-sm font-semibold">Identificador de las fichas<input required maxLength={20} pattern="[A-Z][A-Z0-9]{0,19}" className="input-field mt-2 uppercase" placeholder="Ej. REC o HIS" value={config.value.identificador} onChange={e => { setIdentificadorManual(true); cambiarConfig({ identificador: e.target.value.toUpperCase() }); }} /><span className="mt-1 block text-xs font-normal text-slate-500">Ejemplo: {config.value.identificador || "REC"}-{new Date(Date.now() - 4 * 3600000).getUTCFullYear()}-000001. Los códigos ya emitidos conservan su identificador.</span></label>
        <label className="block text-sm font-semibold">Descripción / campaña<textarea rows={2} maxLength={1000} className="textarea-field mt-2" placeholder="Ej. Solicitudes para la convocatoria de Beca Comedor" value={config.value.descripcion} onChange={e => cambiarConfig({ descripcion: e.target.value })} /></label>
        <div className="rounded-xl border border-slate-200 p-4"><h4 className="text-sm font-bold">Periodo de recepción de solicitudes</h4><p className="mt-1 text-xs text-slate-500">Deja ambas fechas vacías para recibir sin límite de fechas. Horario de Bolivia.</p><div className="mt-3 grid gap-4 sm:grid-cols-2">{(["desde", "hasta"] as const).map(campo => <label key={campo} className="block text-sm font-semibold">{campo === "desde" ? "Inicio de recepción" : "Cierre de recepción"}<input type="datetime-local" className="input-field mt-2" value={config.value[campo] ? fechaInputBolivia(config.value[campo]!) : ""} onChange={e => cambiarConfig({ [campo]: e.target.value ? fechaDesdeBolivia(e.target.value) : null })} /></label>)}</div></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Plazo estimado (horas)<input required type="number" min={1} max={720} className="input-field mt-2" value={config.value.plazoHoras} onChange={e => cambiarConfig({ plazoHoras: Number(e.target.value) })} /><span className="mt-1 block text-xs font-normal text-slate-500">Ej. 24 o 48 horas corridas.</span></label><label className="block text-sm font-semibold">Máximo de solicitudes por día<input required type="number" min={1} max={5000} className="input-field mt-2" value={config.value.cupoDiario} onChange={e => cambiarConfig({ cupoDiario: Number(e.target.value) })} /></label></div>
        <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="px-2 text-sm font-semibold">Atención para recojo</legend><p className="mb-3 text-xs text-slate-500">Si el plazo termina fuera de atención, la estimación pasa a la siguiente apertura. La fecha final se confirma en cada solicitud.</p><div className="flex flex-wrap gap-4">{["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dia, i) => <label key={dia} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.value.diasAtencion.includes(i)} onChange={e => cambiarConfig({ diasAtencion: e.target.checked ? [...config.value.diasAtencion, i].sort() : config.value.diasAtencion.filter(d => d !== i) })} />{dia}</label>)}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Hora de apertura<input required type="time" className="input-field mt-2" value={config.value.horaInicio} onChange={e => cambiarConfig({ horaInicio: e.target.value })} /></label><label className="block text-sm font-semibold">Hora de cierre<input required type="time" className="input-field mt-2" value={config.value.horaFin} onChange={e => cambiarConfig({ horaFin: e.target.value })} /></label></div></fieldset>
        <label className="block text-sm font-semibold">Espera mínima para recoger después de marcar listo (minutos)<input required type="number" min={0} max={1440} className="input-field mt-2" value={config.value.demoraRecojoMinutos} onChange={e => cambiarConfig({ demoraRecojoMinutos: Number(e.target.value) })} /><span className="mt-1 block text-xs font-normal text-slate-500">El sistema suma este margen y ajusta a la próxima apertura. Ej. 60 minutos; 0 permite recoger desde ahora si está dentro del horario.</span></label><label className="block text-sm font-semibold">Lugar de recojo<input required minLength={2} maxLength={200} className="input-field mt-2" value={config.value.lugar} onChange={e => cambiarConfig({ lugar: e.target.value })} /></label>
        <label className="block text-sm font-semibold">Requisitos e indicaciones<textarea rows={3} maxLength={2000} className="textarea-field mt-2" value={config.value.requisitos} onChange={e => cambiarConfig({ requisitos: e.target.value })} /></label>
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={config.value.correoHabilitado} onChange={e => cambiarConfig({ correoHabilitado: e.target.checked })} />Enviar correo al confirmar o reprogramar el recojo</label><p className="text-xs text-slate-500">El estudiante siempre verá el seguimiento en su sesión. El correo utiliza el proveedor configurado. Telegram envía avisos únicamente a estudiantes que vincularon voluntariamente su cuenta.</p>
        <button className="btn-primary">{busy ? "Guardando…" : "Guardar configuración"}</button>
      </fieldset></form>}
    </Modal>
  </div>;
}
