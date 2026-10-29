import { FormEvent, useEffect, useState } from "react";
import { AccionDocumento, SolicitudDocumento } from "../../api/documentos.api";
import { DocumentoEstado, fechaDesdeBolivia, fechaDocumento, fechaInputBolivia, nombrePorApellido } from "../../components/DocumentoDetalle";

interface Props {
  solicitud: SolicitudDocumento;
  responsables: { id: string; nombre: string }[];
  demora: number;
  disabled: boolean;
  responsablesDisabled: boolean;
  busy: boolean;
  onAccion: (accion: Omit<AccionDocumento, "version">) => void;
  onReintentar: (canal: "CORREO" | "TELEGRAM") => void;
}

export function DocumentoGestion({ solicitud: s, responsables, demora, disabled, responsablesDisabled, busy, onAccion, onReintentar }: Props) {
  const [modo, setModo] = useState<"DETALLE" | "LISTA" | "ENTREGAR" | "RECHAZAR">("DETALLE");
  const [hojas, setHojas] = useState(s.estado === "LISTA" && s.hojas !== null ? String(s.hojas) : "");
  const [fechaManual, setFechaManual] = useState(false);
  const [fecha, setFecha] = useState(fechaInputBolivia(new Date(Math.max(Date.parse(s.fechaRecojo ?? s.estimadaEn), Date.now() + 3600000)).toISOString()));
  const [lugar, setLugar] = useState(s.lugar);
  const [requisitos, setRequisitos] = useState(s.requisitos);
  const [observacion, setObservacion] = useState("");
  const [responsable, setResponsable] = useState(s.responsable?.id ?? "");
  useEffect(() => { setResponsable(s.responsable?.id ?? ""); }, [s.id, s.responsable?.id]);
  const activa = ["SOLICITADA", "EN_PREPARACION", "LISTA"].includes(s.estado);
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (disabled || modo === "DETALLE") return;
    if (modo === "LISTA") {
      if (!hojas.trim()) return;
      onAccion({ accion: "LISTA", hojas: Number(hojas), lugar, requisitos, observacion,
        ...(fechaManual ? { fechaRecojo: fechaDesdeBolivia(fecha) } : {}) });
    } else onAccion({ accion: modo, observacion });
  }
  const aviso = (canal: "CORREO" | "TELEGRAM") => {
    const a = canal === "CORREO" ? s.correo : s.telegram;
    return <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{canal === "CORREO" ? "Correo" : "Telegram"}: {a?.estado === "ENVIADO" ? "enviado" : a?.estado === "PENDIENTE" ? "en cola" : a?.estado === "ERROR" ? "error al enviar" : "sin aviso"}</span>{a?.estado === "ERROR" && <button type="button" className="font-semibold text-emerald-700 underline" disabled={disabled} onClick={() => onReintentar(canal)}>Reintentar {canal === "CORREO" ? "correo" : "Telegram"}</button>}</div>;
  };
  return <div className="space-y-4">
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cédula de identidad</p>
      <p className="mt-1 break-all font-mono text-2xl font-bold text-slate-900">{s.ci}</p>
      <h2 className="mt-2 text-lg font-bold leading-snug text-slate-900">{nombrePorApellido(s)}</h2>
      <p className="mt-1 text-xs text-slate-500">RU {s.ru}</p>
    </div>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-800">{s.documento}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">{s.codigo}</p></div><DocumentoEstado estado={s.estado} /></div>
    {modo === "DETALLE" ? <>
      <div className="space-y-1 text-sm text-slate-600"><p><strong>Motivo:</strong> {s.motivo}</p>{s.detalle && <p className="whitespace-pre-wrap break-words">{s.detalle}</p>}</div>
      {s.fechaRecojo && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Recojo: <strong>{fechaDocumento(s.fechaRecojo)}</strong><br />{s.hojas} hojas · {s.lugar}</p>}
      <fieldset disabled={disabled} className="flex flex-wrap gap-2">
        {activa && <button className="btn-primary" onClick={() => setModo("LISTA")}>{s.estado === "LISTA" ? "Reprogramar recojo" : "Marcar impreso y listo"}</button>}
        {s.estado === "SOLICITADA" && <button className="btn-secondary" onClick={() => onAccion({ accion: "PREPARAR" })}>{busy ? "Guardando…" : "Iniciar preparación"}</button>}
        {s.estado === "LISTA" && <button className="btn-secondary" onClick={() => setModo("ENTREGAR")}>Registrar entrega</button>}
      </fieldset>
      <details className="border-t border-slate-200 pt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Más opciones y seguimiento</summary>
        <div className="mt-4 space-y-4 text-sm text-slate-600">
          <p>Solicitado: {fechaDocumento(s.creadaEn)}<br />Estimado: {fechaDocumento(s.estimadaEn)}</p>
          <p className="whitespace-pre-wrap break-words">{s.lugar}{s.requisitos && ` · ${s.requisitos}`}</p>
          {activa ? <fieldset disabled={disabled || responsablesDisabled} className="space-y-2"><label className="block text-xs font-semibold">Responsable<select className="select-field mt-1 w-full" value={responsable} onChange={e => setResponsable(e.target.value)}><option value="">Sin asignar</option>{responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></label><button className="btn-secondary" disabled={responsable === (s.responsable?.id ?? "")} onClick={() => onAccion({ accion: "ASIGNAR", idResponsable: responsable || null })}>Guardar responsable</button></fieldset> : <p>Responsable: {s.responsable?.nombre ?? "Sin asignar"}</p>}
          {s.estado === "LISTA" && <div className="space-y-2">{aviso("CORREO")}{aviso("TELEGRAM")}</div>}
          {["SOLICITADA", "EN_PREPARACION"].includes(s.estado) && <button className="text-sm font-semibold text-red-700" disabled={disabled} onClick={() => setModo("RECHAZAR")}>Rechazar solicitud</button>}
          <ol className="space-y-3 border-t border-slate-100 pt-3">{s.eventos.map(e => <li key={e.id} className="border-l-2 border-slate-200 pl-3"><p className="text-xs text-slate-400">{fechaDocumento(e.fecha)}</p><p className="mt-1 whitespace-pre-wrap break-words text-xs">{e.descripcion}</p></li>)}</ol>
        </div>
      </details>
    </> : <form onSubmit={enviar}><fieldset disabled={disabled} className="space-y-4">
      {modo === "LISTA" && <>
        <label className="block text-sm font-semibold">Cantidad de hojas en blanco<input autoFocus required type="number" min={0} max={100} step={1} className="input-field mt-2" value={hojas} onChange={e => setHojas(e.target.value)} placeholder="Indica cuántas hojas debe traer" /><span className="mt-1 block text-xs font-normal text-slate-500">Indica 0 si no necesita traer hojas.</span></label>
        <p className="text-xs leading-5 text-slate-500">Hora automática: desde {demora} minutos después de marcar listo, ajustada al horario de atención. El sistema avisará al estudiante.</p>
        <details className="border-t border-slate-200 pt-3"><summary className="cursor-pointer text-sm text-slate-600">Cambiar fecha o indicaciones</summary><div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fechaManual} onChange={e => setFechaManual(e.target.checked)} />Programar otra fecha</label>
          {fechaManual && <label className="block text-xs font-semibold">Fecha y hora (Bolivia)<input required type="datetime-local" className="input-field mt-1" value={fecha} onChange={e => setFecha(e.target.value)} /></label>}
          <label className="block text-xs font-semibold">Lugar de recojo<input required minLength={2} maxLength={200} className="input-field mt-1" value={lugar} onChange={e => setLugar(e.target.value)} /></label>
          <label className="block text-xs font-semibold">Indicaciones<textarea className="textarea-field mt-1" rows={2} maxLength={2000} value={requisitos} onChange={e => setRequisitos(e.target.value)} /></label>
          <label className="block text-xs font-semibold">Observación (opcional)<textarea className="textarea-field mt-1" rows={2} maxLength={2000} value={observacion} onChange={e => setObservacion(e.target.value)} /></label>
        </div></details>
      </>}
      {modo === "ENTREGAR" && <p className="text-sm text-slate-600">Comprueba el CI y confirma después de entregar el documento al estudiante.</p>}
      {modo === "RECHAZAR" && <label className="block text-sm font-semibold">Motivo del rechazo<input autoFocus required minLength={5} maxLength={2000} className="input-field mt-2" value={observacion} onChange={e => setObservacion(e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">El estudiante podrá leer este motivo.</span></label>}
      <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={modo === "LISTA" && !hojas.trim()}>{busy ? "Guardando…" : modo === "LISTA" ? "Marcar listo y notificar" : modo === "ENTREGAR" ? "Confirmar entrega" : "Confirmar rechazo"}</button><button type="button" className="btn-secondary" onClick={() => { setModo("DETALLE"); setObservacion(""); }}>Volver</button></div>
    </fieldset></form>}
  </div>;
}
