import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fichasApi, JornadaPayload, Tramite, TramitePayload } from "../../api/fichas.api";
import { JornadaEstudiante } from "../../api/estudiantes.api";
import { mensajeError, usePolling } from "../../hooks/usePolling";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TVControl } from "../components/TVControl";
import { identificadorDisponible, sugerirIdentificador } from "../../utils/fichaIdentificador";

const hoy = () => new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const nuevaJornada = (fecha: string): JornadaPayload => ({ idTramite: "", identificador: "", fecha, horaInicio: "08:00", horaFin: "16:00", modoCupo: "TIEMPO", cupoTotal: 48, minutosPorEstudiante: 10, puesto: "Ventanilla 1", estado: "ACTIVO" });

export default function FichasPage() {
  const [fecha, setFecha] = useState(hoy);
  const [tab, setTab] = useState<"atencion" | "tramites" | "tv">("atencion");
  const [seleccion, setSeleccion] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formJornada, setFormJornada] = useState<JornadaPayload | null>(null);
  const [editJornada, setEditJornada] = useState<string>();
  const [identificadorManual, setIdentificadorManual] = useState(false);
  const [formTramite, setFormTramite] = useState<TramitePayload | null>(null);
  const [identificadorTramiteManual, setIdentificadorTramiteManual] = useState(false);
  const [editTramite, setEditTramite] = useState<string>();
  const [borrar, setBorrar] = useState<Tramite | null>(null);
  const load = useCallback(async () => (await fichasApi.panel(fecha)).data.data, [fecha]);
  const { data, loading, error: loadError, refresh } = usePolling(load);
  const jornada = data?.jornadas.find(j => j.idJornada === seleccion) ?? data?.jornadas[0];
  const fichas = data?.fichas.filter(f => f.jornada.idJornada === jornada?.idJornada) ?? [];
  const actual = fichas.find(f => f.estado === "LLAMADA");
  const identificadorBloqueado = !!editJornada && (data?.jornadas.find(j => j.idJornada === editJornada)?.emitidas ?? 0) > 0;
  const tramiteElegido = data?.tramites.find(t => t.idTramite === formJornada?.idTramite);
  const nombreTramite = formJornada?.idTramite === null ? "Atención general" : tramiteElegido?.nombre ?? "";
  const sugerenciaIdentificador = identificadorDisponible(tramiteElegido?.identificador ?? sugerirIdentificador(nombreTramite), data?.jornadas.filter(j => j.fecha === formJornada?.fecha && j.idJornada !== editJornada).map(j => j.identificador) ?? []);
  const sugerenciaTramite = sugerirIdentificador(formTramite?.nombre ?? "", data?.tramites.filter(t => t.idTramite !== editTramite && t.identificador).map(t => t.identificador!) ?? []);
  const cupoCalculado = formJornada ? Math.max(0, Math.floor((minutos(formJornada.horaFin) - minutos(formJornada.horaInicio)) / (formJornada.minutosPorEstudiante || 1))) : 0;

  useEffect(() => {
    if (!identificadorManual) setFormJornada(actual => actual && actual.identificador !== sugerenciaIdentificador ? { ...actual, identificador: sugerenciaIdentificador } : actual);
  }, [sugerenciaIdentificador, identificadorManual]);
  useEffect(() => {
    if (!identificadorTramiteManual) setFormTramite(actual => actual && actual.identificador !== sugerenciaTramite ? { ...actual, identificador: sugerenciaTramite } : actual);
  }, [sugerenciaTramite, identificadorTramiteManual]);

  async function actuar(fn: () => Promise<unknown>, message: string, close?: () => void) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setSuccess("");
    try { await fn(); setSuccess(message); close?.(); }
    catch (e) { setError(mensajeError(e)); }
    finally { busyRef.current = false; setBusy(false); refresh(); }
  }
  function editarJornada(j?: JornadaEstudiante) {
    setError(""); setEditJornada(j?.idJornada); setIdentificadorManual(!!j); setFormJornada(j ? { ...j } : nuevaJornada(fecha));
  }
  function editarTramite(t?: Tramite) {
    setError(""); setEditTramite(t?.idTramite); setIdentificadorTramiteManual(!!t?.identificador);
    setFormTramite(t ? { nombre: t.nombre, descripcion: t.descripcion, identificador: t.identificador ?? "" } : { nombre: "", descripcion: "", identificador: "" });
  }
  function guardarJornada(event: FormEvent) {
    event.preventDefault();
    if (!formJornada) return;
    const payload = { ...formJornada, cupoTotal: formJornada.modoCupo === "TIEMPO" ? cupoCalculado : formJornada.cupoTotal };
    void actuar(() => fichasApi.guardarJornada(payload, editJornada), "Configuración de la jornada guardada.", () => { setFecha(payload.fecha); setFormJornada(null); });
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-bold text-slate-800">Fichas y atención</h1><p className="mt-1 text-sm text-slate-500">Configura los cupos y atiende a los estudiantes en orden de llegada a la cola.</p></div><Link to="/atencion/pantalla" target="_blank" rel="noreferrer" className="btn-secondary">Abrir pantalla TV ↗</Link></div>
    <div className="flex flex-wrap gap-2" aria-label="Secciones de fichas">{([['atencion', 'Atención y cupos'], ['tramites', 'Tipos de trámite'], ['tv', 'Configurar TV']] as const).map(([id, label]) => <button key={id} className={tab === id ? "btn-primary" : "btn-secondary"} onClick={() => setTab(id)} aria-pressed={tab === id}>{label}</button>)}</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {loadError && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No se pudo actualizar la atención. {loadError} <button className="underline" onClick={refresh}>Reintentar</button></p>}
    {tab === "tv" ? <TVControl /> : tab === "atencion" ? <>
      <div className="flex flex-wrap items-end justify-between gap-3"><label className="text-sm font-semibold text-slate-600">Fecha de atención<input aria-label="Fecha de atención" type="date" required className="input-field mt-2" value={fecha} onChange={e => { if (e.target.value) { setFecha(e.target.value); setSeleccion(""); setError(""); setSuccess(""); } }} /></label><div className="flex gap-2"><button className="btn-secondary" onClick={refresh}>Actualizar</button><button className="btn-primary" onClick={() => editarJornada()} disabled={loading || !data?.tramites.length}>Programar jornada</button></div></div>
      {loading && <p role="status">Cargando jornadas…</p>}
      {data && <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
          ["Cupos del día", data.jornadas.reduce((n, j) => n + j.cupoTotal, 0)],
          ["Fichas emitidas", data.jornadas.reduce((n, j) => n + j.ocupadas, 0)],
          ["En espera", data.jornadas.reduce((n, j) => n + j.enEspera, 0)],
          ["Atendidas", data.jornadas.reduce((n, j) => n + j.atendidas, 0)],
        ].map(([label, value]) => <div key={label} className="card p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-slate-800">{value}</p></div>)}</div>
        {!data.jornadas.length ? <div className="card p-8 text-center"><h2 className="font-bold text-slate-700">No hay jornadas para esta fecha</h2><p className="mt-2 text-sm text-slate-500">Programa un trámite con horario y cupo para que los estudiantes puedan generar sus fichas.</p>{!data.tramites.length && <button className="btn-secondary mt-4" onClick={() => { setTab("tramites"); editarTramite(); }}>Crear un trámite</button>}</div> : <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.jornadas.map(j => <article key={j.idJornada} className={`card border-2 p-4 ${jornada?.idJornada === j.idJornada ? "border-emerald-600" : "border-transparent"}`}>
            <button className="w-full text-left" onClick={() => setSeleccion(j.idJornada)} aria-pressed={jornada?.idJornada === j.idJornada}><div className="flex justify-between gap-2"><h2 className="font-bold text-slate-800">{j.tramite}</h2><span className="text-xs font-semibold text-slate-500">{j.estado === "ACTIVO" ? "Activa" : "Pausada"}</span></div><p className="mt-2 text-xs text-slate-500">{j.horaInicio} – {j.horaFin} · {j.puesto}</p><p className="mt-3 text-sm text-emerald-800">{j.ocupadas} / {j.cupoTotal} fichas · {j.disponibles} libres</p><p className="mt-1 text-xs text-slate-500">{j.modoCupo === "TIEMPO" ? "Cupo calculado" : "Cupo manual"} · {j.minutosPorEstudiante} min por estudiante</p></button>
            <p className="mt-2 break-all text-xs font-semibold text-slate-600">Identificador: {j.identificador} · Numeración automática</p>
            <div className="mt-4 flex flex-wrap gap-3"><button className="text-sm font-semibold text-emerald-700" disabled={busy} onClick={() => editarJornada(j)}>Configurar</button><button className="text-sm font-semibold text-slate-600" disabled={busy || fecha < hoy()} onClick={() => void actuar(() => fichasApi.guardarJornada({ ...j, estado: j.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO" }, j.idJornada), j.estado === "ACTIVO" ? "Jornada pausada: se detienen las reservas y los nuevos llamados." : "Jornada activada.")}>{j.estado === "ACTIVO" ? "Pausar" : "Activar"}</button></div>
          </article>)}</div>
          {jornada && <section className="card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-bold text-slate-800">Atender · {jornada.tramite}</h2><p className="mt-1 text-sm text-slate-500">{jornada.puesto} · Llama al siguiente número y registra el resultado antes de continuar.</p></div>
            <div className="grid gap-5 p-5 lg:grid-cols-2"><div className="rounded-xl bg-emerald-50 p-6"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">En atención</p><p className="mt-3 break-all text-4xl font-extrabold text-emerald-900">{actual?.codigo ?? "—"}</p><p className="mt-3 font-bold text-slate-800">{actual?.solicitante ?? "Sin turno llamado"}</p>{actual && <><p className="mt-1 text-sm text-slate-500">RU: {actual.ru}</p><p className="mt-4 whitespace-pre-line break-words text-sm text-slate-600">{actual.motivo}</p></>}</div>
              <div className="flex flex-col justify-center gap-3">{actual ? <><button className="btn-primary" disabled={busy || !!loadError} onClick={() => void actuar(() => fichasApi.accion(actual.idFicha, "FINALIZAR"), "Atención finalizada. Puedes llamar al siguiente estudiante.")}>Finalizar atención</button><button className="btn-secondary" disabled={busy || !!loadError} onClick={() => void actuar(() => fichasApi.accion(actual.idFicha, "RELLAMAR"), "Llamado repetido en el tablero.")}>Volver a llamar</button><button className="btn-secondary" disabled={busy || !!loadError} onClick={() => void actuar(() => fichasApi.accion(actual.idFicha, "AUSENTE"), "Ficha marcada como no presentada.")}>No se presentó</button></> : <button className="btn-primary py-4" disabled={busy || !!loadError || fecha !== hoy() || jornada.estado !== "ACTIVO" || jornada.enEspera === 0} onClick={() => void actuar(() => fichasApi.siguiente(jornada.idJornada), "Turno llamado. Ya aparece en el tablero público.")}>{busy ? "Llamando…" : "Llamar siguiente →"}</button>}<p className="text-xs leading-5 text-slate-500">{fecha !== hoy() ? "Los llamados se habilitan el día de la atención." : "La cola se actualiza automáticamente cada 5 segundos. Los llamados se habilitan desde la hora de inicio."}</p></div>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">Ficha</th><th className="px-5 py-3">Estudiante</th><th className="px-5 py-3">Solicitud</th><th className="px-5 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100">{fichas.map(f => <tr key={f.idFicha} className={f.estado === "LLAMADA" ? "bg-emerald-50" : ""}><td className="whitespace-nowrap px-5 py-3 font-bold">{f.codigo}</td><td className="px-5 py-3"><p className="font-medium">{f.solicitante}</p><p className="text-xs text-slate-500">RU {f.ru}</p></td><td className="max-w-xs whitespace-pre-line break-words px-5 py-3 text-slate-500">{f.motivo}</td><td className="whitespace-nowrap px-5 py-3 text-xs font-semibold">{f.estado}</td></tr>)}{!fichas.length && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Todavía no se emitieron fichas para esta jornada.</td></tr>}</tbody></table></div>
          </section>}
        </>}
      </>}
    </> : <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-800">Tipos de trámite</h2><p className="text-sm text-slate-500">Crea los motivos de atención que necesite Kardex.</p></div><button className="btn-primary" onClick={() => editarTramite()}>Nuevo trámite</button></div>
      {loading && <p>Cargando trámites…</p>}
      {data?.tramites.map(t => <article key={t.idTramite} className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0"><h3 className="font-bold text-slate-700">{t.nombre}</h3><p className="mt-1 text-sm text-slate-500">{t.descripcion}</p>{t.identificador && <p className="mt-2 break-all text-sm text-emerald-800">Identificador: <strong>{t.identificador}</strong> · {t.identificador}-001, {t.identificador}-002…</p>}</div>
        <div className="flex gap-3"><button className="btn-secondary" onClick={() => editarTramite(t)}>Editar</button><button className="btn-danger" onClick={() => { setError(""); setBorrar(t); }}>Eliminar</button></div>
      </article>)}
    </section>}

    <Modal title={editJornada ? "Configurar jornada" : "Programar jornada"} open={!!formJornada} onClose={() => { if (!busy) setFormJornada(null); }}>
      {formJornada && <form onSubmit={guardarJornada} className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-semibold">Trámite<select required className="select-field mt-1 w-full" value={formJornada.idTramite ?? "legacy"} onChange={e => setFormJornada({ ...formJornada, idTramite: e.target.value === "legacy" ? null : e.target.value })}><option value="">Selecciona un trámite</option>{formJornada.idTramite === null && <option value="legacy">Atención general (anterior)</option>}{data?.tramites.map(t => <option key={t.idTramite} value={t.idTramite}>{t.nombre}</option>)}</select></label>
          <label className="block text-sm font-semibold">Fecha<input className="input-field mt-1" type="date" min={hoy()} required value={formJornada.fecha} onChange={e => setFormJornada({ ...formJornada, fecha: e.target.value })} /></label>
          <div>
            <label htmlFor="identificador-fichas" className="block text-sm font-semibold">Identificador de las fichas</label>
            <input id="identificador-fichas" className={`input-field mt-1 ${identificadorBloqueado ? "bg-slate-100 text-slate-500" : ""}`} required maxLength={20} pattern="[A-Za-z][A-Za-z0-9]{0,19}" title="De 1 a 20 letras o números, comenzando con una letra" value={formJornada.identificador} readOnly={identificadorBloqueado} onChange={e => { setIdentificadorManual(true); setFormJornada({ ...formJornada, identificador: e.target.value.toUpperCase() }); }} placeholder="Ej. KAR, HIS, A" autoCapitalize="characters" spellCheck={false} aria-describedby="identificador-ayuda numeracion-fichas" />
            {!identificadorBloqueado && sugerenciaIdentificador && <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><p className="text-emerald-800">Sugerido según el trámite: <strong>{sugerenciaIdentificador}</strong>. Puedes editarlo.</p>{formJornada.identificador !== sugerenciaIdentificador && <button type="button" className="font-semibold text-emerald-700 underline" onClick={() => { setIdentificadorManual(false); setFormJornada({ ...formJornada, identificador: sugerenciaIdentificador }); }}>Usar sugerencia</button>}</div>}
            <p id="identificador-ayuda" className="mt-2 text-xs text-slate-500">{identificadorBloqueado ? "El identificador se conserva porque ya se emitieron fichas para esta jornada." : "Elige de 1 a 20 letras o números, comenzando con una letra. Debe ser diferente al de otras jornadas de la misma fecha."}</p>
            <div id="numeracion-fichas" className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p className="font-semibold">Numeración automática</p><p className="mt-1 break-all font-mono">Ejemplo: {formJornada.identificador || "KAR"}-001, {formJornada.identificador || "KAR"}-002, {formJornada.identificador || "KAR"}-003…</p><p className="mt-2 text-xs">Cada jornada comienza en 001. El número se asigna al solicitar la ficha y no se reutiliza al cancelarla.</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Desde<input className="input-field mt-1" type="time" required value={formJornada.horaInicio} onChange={e => setFormJornada({ ...formJornada, horaInicio: e.target.value })} /></label><label className="text-sm font-semibold">Hasta<input className="input-field mt-1" type="time" required value={formJornada.horaFin} onChange={e => setFormJornada({ ...formJornada, horaFin: e.target.value })} /></label></div>
          <label className="block text-sm font-semibold">Puesto de atención<input className="input-field mt-1" required minLength={2} maxLength={80} value={formJornada.puesto} onChange={e => setFormJornada({ ...formJornada, puesto: e.target.value })} placeholder="Ej. Ventanilla 1" /></label>
          <label className="block text-sm font-semibold">Cómo definir el cupo<select className="select-field mt-1 w-full" value={formJornada.modoCupo} onChange={e => setFormJornada({ ...formJornada, modoCupo: e.target.value as "MANUAL" | "TIEMPO" })}><option value="TIEMPO">Calcular según tiempo por estudiante</option><option value="MANUAL">Ingresar límite manual</option></select></label>
          <label className="block text-sm font-semibold">Minutos estimados por estudiante<input className="input-field mt-1" type="number" required min={1} max={480} value={formJornada.minutosPorEstudiante || ""} onChange={e => setFormJornada({ ...formJornada, minutosPorEstudiante: Number(e.target.value) })} /></label>
          {formJornada.modoCupo === "MANUAL" && <label className="block text-sm font-semibold">Límite de fichas para este trámite en el día<input className="input-field mt-1" type="number" required min={1} max={10000} value={formJornada.cupoTotal || ""} onChange={e => setFormJornada({ ...formJornada, cupoTotal: Number(e.target.value) })} /></label>}
          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><strong>{formJornada.modoCupo === "TIEMPO" ? cupoCalculado : formJornada.cupoTotal} fichas</strong> para esta jornada.<p className="mt-1 text-xs">{formJornada.modoCupo === "TIEMPO" ? "Se divide la duración del horario entre los minutos por estudiante y se redondea hacia abajo." : "La duración se usa para estimar la espera. El límite lo defines tú."}</p></div>
          <label className="block text-sm font-semibold">Disponibilidad<select className="select-field mt-1 w-full" value={formJornada.estado} onChange={e => setFormJornada({ ...formJornada, estado: e.target.value as "ACTIVO" | "INACTIVO" })}><option value="ACTIVO">Activa</option><option value="INACTIVO">Pausada</option></select></label>
          <p className="text-xs text-slate-500">Una jornada por trámite y fecha. Si ya tiene fichas, conserva su identificador, fecha, horario, trámite y puesto.</p>
          <button className="btn-primary w-full" disabled={formJornada.modoCupo === "TIEMPO" && cupoCalculado < 1}>{busy ? "Guardando…" : "Guardar jornada"}</button>
        </fieldset>
      </form>}
    </Modal>
    <Modal title={editTramite ? "Editar trámite" : "Nuevo trámite"} open={!!formTramite} onClose={() => { if (!busy) setFormTramite(null); }}>
      {formTramite && <form onSubmit={e => { e.preventDefault(); void actuar(() => fichasApi.guardarTramite(formTramite, editTramite), "Trámite guardado.", () => setFormTramite(null)); }} className="space-y-4">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-semibold">Nombre<input className="input-field mt-1" required minLength={3} maxLength={150} value={formTramite.nombre} onChange={e => setFormTramite({ ...formTramite, nombre: e.target.value })} /></label>
          <div>
            <label htmlFor="identificador-tramite" className="block text-sm font-semibold">Identificador de las fichas</label>
            <input id="identificador-tramite" className="input-field mt-1" required maxLength={20} pattern="[A-Za-z][A-Za-z0-9]{0,19}" title="De 1 a 20 letras o números, comenzando con una letra" value={formTramite.identificador} onChange={e => { setIdentificadorTramiteManual(true); setFormTramite({ ...formTramite, identificador: e.target.value.toUpperCase() }); }} placeholder="Ej. ARM" autoCapitalize="characters" spellCheck={false} aria-describedby="sugerencia-tramite ayuda-identificador-tramite" />
            <div id="sugerencia-tramite" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-800">
              {sugerenciaTramite ? <><p>Sugerido según el nombre: <strong>{sugerenciaTramite}</strong>. Puedes editarlo.</p>{formTramite.identificador !== sugerenciaTramite && <button type="button" className="font-semibold underline" onClick={() => { setIdentificadorTramiteManual(false); setFormTramite({ ...formTramite, identificador: sugerenciaTramite }); }}>Usar sugerencia</button>}</> : <p>Escribe el nombre para obtener una sugerencia.</p>}
            </div>
            <p id="ayuda-identificador-tramite" className="mt-2 text-xs text-slate-500">De 1 a 20 letras o números, comenzando con una letra. Se usará en las nuevas jornadas de este trámite; las ya programadas conservan su identificador.</p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p className="font-semibold">Numeración automática</p><p className="mt-1 break-all font-mono">{formTramite.identificador || "ARM"}-001, {formTramite.identificador || "ARM"}-002, {formTramite.identificador || "ARM"}-003…</p></div>
          </div>
          <label className="block text-sm font-semibold">Descripción<textarea className="textarea-field mt-1" maxLength={500} rows={3} value={formTramite.descripcion} onChange={e => setFormTramite({ ...formTramite, descripcion: e.target.value })} /></label>
          <button className="btn-primary w-full">{busy ? "Guardando…" : "Guardar trámite"}</button>
        </fieldset>
      </form>}
    </Modal>
    <ConfirmDialog open={!!borrar} title="Eliminar trámite" message={`Se retirará «${borrar?.nombre}» de las nuevas solicitudes. Sus fichas históricas se conservarán.`} loading={busy} onCancel={() => setBorrar(null)} onConfirm={() => { const t = borrar; setBorrar(null); if (t) void actuar(() => fichasApi.borrarTramite(t.idTramite), "Trámite eliminado. Su historial se conserva."); }} />
  </div>;
}
