import { useEffect, useMemo, useRef, useState } from 'react';
import type { Aula } from '../../api/types';
import type { Periodo } from '../../api/academico.api';
import { horarioImportApi, type ImportInput, type ImportPreview, type ImportSummary } from '../../api/horario-import.api';
import { automaticSessions, normalizePdfRoom, type PdfGroup, type PdfSchedule } from '../schedule/pdf-import';
import { readSchedulePdf } from '../../utils/horarioPdfImport';
import { Modal } from './Modal';
import { ErrorNotice, errorAcademico, Field } from './AcademicoUI';

interface Props { periodo: string; periodos: Periodo[]; aulas: Aula[]; close: () => void; saved: (periodo: string) => Promise<void> }
type Choices = Record<string, number[]>;
function importInput(pdf: PdfSchedule, choices: Choices, idPeriodo: string): ImportInput {
  return { idPeriodo, grupos: pdf.grupos.filter(g => ready(g, choices)).map(g => ({ key: g.key, pagina: g.pagina,
    materia: g.materia, siglas: g.siglas, docente: g.docente, paralelo: g.paralelo,
    sesiones: choices[g.key].map(i => { const s = g.sesiones[i]; return { dia: s.dia, horaInicio: s.horaInicio, horaFin: s.horaFin, aula: s.aula }; }),
  })) };
}
function ready(g: PdfGroup, choices: Choices) {
  const selected = (choices[g.key] ?? []).map(i => g.sesiones[i]);
  return !g.errores.length && selected.length === 2 && selected.every(s => s.aula && !s.excluida) && selected[0].dia !== selected[1].dia;
}
export function HorarioPdfImport({ periodo, periodos, aulas, close, saved }: Props) {
  const [idPeriodo, setPeriodo] = useState(periodo), [pdf, setPdf] = useState<PdfSchedule | null>(null);
  const [choices, setChoices] = useState<Choices>({}), [name, setName] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(''), [allowPeriod, setAllowPeriod] = useState(false);
  const [review, setReview] = useState<{ input: ImportInput; result: ImportPreview } | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null), [filter, setFilter] = useState<'pendientes' | 'todos'>('pendientes');
  const container = useRef<HTMLDivElement>(null);
  const period = periodos.find(p => p.idPeriodo === idPeriodo);
  const mismatch = Boolean(pdf?.periodo && period && (pdf.periodo.gestion !== period.gestion || pdf.periodo.periodo !== period.periodo));
  const selectedCount = pdf?.grupos.filter(g => ready(g, choices)).length ?? 0;
  const pending = pdf?.grupos.filter(g => !ready(g, choices) || review?.result.grupos.find(r => r.key === g.key)?.estado === 'REVISAR') ?? [];
  const shown = filter === 'todos' ? pdf?.grupos ?? [] : pending;
  const availableRooms = useMemo(() => aulas.filter(a => a.estado === 'disponible').sort((a, b) => a.codigo.localeCompare(b.codigo)), [aulas]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    container.current?.querySelector<HTMLElement>('input')?.focus();
    return () => previous?.focus();
  }, []);
  function invalidate() { setReview(null); setError(''); }
  async function validate(document = pdf, selection = choices, target = idPeriodo) {
    if (!document) return;
    const input = importInput(document, selection, target);
    if (!input.grupos.length) { setError('Selecciona dos sesiones en días distintos y sus aulas para al menos un paralelo.'); return; }
    setBusy(true); setProgress('Comprobando materias, docentes, aulas y cruces…'); setError(''); setReview(null);
    try { setReview({ input, result: await horarioImportApi.preview(input) }); }
    catch (e) { setError(errorAcademico(e)); }
    finally { setBusy(false); setProgress(''); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setProgress('Abriendo PDF…'); setError(''); setPdf(null); setReview(null); setResult(null); setName(file.name); setAllowPeriod(false);
    try {
      const document = await readSchedulePdf(file, setProgress);
      const selection: Choices = {};
      for (const g of document.grupos) {
        for (const s of g.sesiones) {
          if (!s.aula) continue;
          const matches = availableRooms.filter(a => normalizePdfRoom(a.codigo) === s.aula);
          s.aula = matches.length === 1 ? matches[0].codigo : '';
        }
        selection[g.key] = automaticSessions(g);
      }
      setPdf(document); setChoices(selection); setFilter('pendientes');
      const different = document.periodo && period && (document.periodo.gestion !== period.gestion || document.periodo.periodo !== period.periodo);
      if (period && !different && document.grupos.some(g => ready(g, selection))) await validate(document, selection);
    } catch (e) { setError(errorAcademico(e)); }
    finally { setBusy(false); setProgress(''); }
  }
  function choose(g: PdfGroup, index: number) {
    invalidate();
    setChoices(current => { const before = current[g.key] ?? []; return { ...current, [g.key]: before.includes(index) ? before.filter(i => i !== index) : [...before, index] }; });
  }
  function changeRoom(key: string, index: number, aula: string) {
    invalidate();
    setPdf(p => p && ({ ...p, grupos: p.grupos.map(g => g.key !== key ? g : { ...g, sesiones: g.sesiones.map((s, i) => i === index ? { ...s, aula } : s) }) }));
  }
  async function apply() {
    if (!review) return;
    setBusy(true); setProgress('Guardando los horarios validados…'); setError('');
    try { const summary = await horarioImportApi.apply(review.input, review.result.huella); setResult(summary); await saved(idPeriodo); }
    catch (e) { setError(errorAcademico(e)); setReview(null); }
    finally { setBusy(false); setProgress(''); }
  }
  function downloadReport() {
    if (!pdf) return;
    const report = { archivo: name, periodo: period && `${period.periodo}/${period.gestion}`, resultado: result,
      avisos: pdf.avisos, grupos: pdf.grupos.map(g => ({ ...g, seleccionadas: choices[g.key] ?? [], revision: review?.result.grupos.find(r => r.key === g.key) ?? null })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'revision-horarios.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Modal open title="Importar horarios desde PDF" size="wide" onClose={() => !busy && close()}>
    <div ref={container} className="space-y-4" onKeyDown={e => {
      if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const dialog = container.current?.closest('[role="dialog"]');
        const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
        if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls[controls.length - 1]?.focus(); }
        else if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) { e.preventDefault(); controls[0]?.focus(); }
      }
    }}>
      <p className="text-sm text-slate-600">Carga el PDF con las columnas Paralelo, Docente y Horario. Se completarán las clases de dos horas, en dos días distintos por materia y paralelo. Las sesiones de auxiliar no se importan.</p>
      <ErrorNotice message={error} />
      {result ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <h4 className="font-semibold">Importación completada</h4><p>{result.sesiones} sesiones guardadas en {result.grupos} paralelos de {period?.periodo}/{period?.gestion}.</p>
        <p>{result.materias} materias nuevas · {result.docentes} docentes nuevos · {result.existentes} paralelos ya registrados.</p>
        <p>Quedaron {pending.length} grupos por revisar. Puedes descargar el informe con las sesiones del PDF.</p>
        <button className="btn-secondary" onClick={downloadReport}>Descargar informe</button>
        <button className="btn-primary ml-2" onClick={close}>Ver horarios</button>
      </div> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Periodo de destino"><select className="select-field" disabled={busy} value={idPeriodo} onChange={e => { setPeriodo(e.target.value); setAllowPeriod(false); invalidate(); }}><option value="">Selecciona un periodo</option>{periodos.filter(p => p.estado === 'ACTIVO').map(p => <option key={p.idPeriodo} value={p.idPeriodo}>{p.periodo}/{p.gestion}</option>)}</select></Field>
          <Field label="Archivo PDF (hasta 20 MB)"><input type="file" accept=".pdf,application/pdf" disabled={busy} className="input-field" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void upload(file); }} /></Field>
        </div>
        {busy && <p role="status" aria-live="polite" className="text-sm font-medium text-blue-700">{progress}</p>}
        {mismatch && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>El PDF indica {pdf?.periodo?.periodo}/{pdf?.periodo?.gestion}; el destino es {period?.periodo}/{period?.gestion}.</p><label className="mt-2 flex gap-2"><input type="checkbox" disabled={busy} checked={allowPeriod} onChange={e => { setAllowPeriod(e.target.checked); invalidate(); }} />Usar estos horarios en el periodo de destino seleccionado.</label></div>}
        {pdf && <>
          <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2"><p className="font-semibold break-all">{name}</p><p>{pdf.grupos.length} grupos detectados · {selectedCount} con dos sesiones seleccionadas · {pending.length} por revisar</p>
            <p>Si hay más de dos sesiones posibles, elige las dos del docente. Las demás se omitirán. Un aula con varias opciones debe confirmarse.</p>
            {pdf.avisos.map((notice, i) => <p className="text-amber-800" key={i}>{notice}</p>)}
          </div>
          {review && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm space-y-1">
            <p className="font-semibold">{review.result.resumen.sesiones} sesiones listas para guardar · {review.result.resumen.existentes} paralelos ya registrados · {review.result.resumen.pendientes} con conflictos</p>
            <p>Se crearán {review.result.resumen.materias} materias, {review.result.resumen.docentes} docentes y {review.result.resumen.asignaciones} asignaciones que faltan en el catálogo.</p>
          </div>}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><button disabled={busy} className="btn-secondary" onClick={close}>Cerrar</button><button disabled={busy || !period || !selectedCount || (mismatch && !allowPeriod)} className="btn-secondary" onClick={() => void validate()}>Validar selección</button><button className="btn-primary" disabled={busy || !review?.result.resumen.sesiones || (mismatch && !allowPeriod)} onClick={() => void apply()}>Importar {review?.result.resumen.sesiones ?? 0} sesiones</button></div>
          <div className="flex flex-wrap items-center gap-2"><button className={filter === 'pendientes' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('pendientes')}>Por revisar ({pending.length})</button><button className={filter === 'todos' ? 'btn-primary' : 'btn-secondary'} onClick={() => setFilter('todos')}>Todos ({pdf.grupos.length})</button><button className="btn-ghost" onClick={downloadReport}>Descargar informe</button></div>
          <div className="space-y-3" aria-label="Clases detectadas en el PDF">
            {!shown.length && <p className="text-sm text-emerald-700">No hay grupos pendientes de revisión.</p>}
            {shown.map(g => {
              const row = review?.result.grupos.find(r => r.key === g.key), selected = choices[g.key] ?? [];
              return <details key={g.key} className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm"><span className="font-semibold">{g.siglas.join(' / ')} · {g.materia} · Paralelo {g.paralelo}</span><span className="block mt-1 text-slate-600">{g.docente || 'Sin docente'} · Pág. {g.pagina} · {row?.estado === 'EXISTENTE' ? 'Ya registrado' : row?.estado === 'REVISAR' ? 'Conflicto: revisar' : ready(g, choices) ? 'Dos sesiones seleccionadas' : `${selected.length}/2 sesiones seleccionadas`}</span></summary>
                <div className="mt-3 space-y-3 text-sm">
                  {[...g.errores, ...(row?.errores ?? [])].map((message, i) => <p key={i} className="text-red-700">{message}</p>)}
                  {row?.nuevaMateria && <p className="text-blue-700">Materia nueva: se añadirá al catálogo usando el nombre y las siglas del PDF.{row.planes.length ? ' Tiene coincidencia en los planes de estudio.' : ''}</p>}
                  {g.sesiones.map((s, i) => <div key={i} className={`rounded-lg border p-3 ${s.excluida ? 'bg-slate-50 text-slate-500' : 'border-slate-200'}`}>
                    <label className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(i)} disabled={busy || Boolean(s.excluida) || Boolean(g.errores.length) || (!selected.includes(i) && (selected.length >= 2 || selected.some(n => g.sesiones[n].dia === s.dia)))} onChange={() => choose(g, i)} /><span>{s.dia} {s.horaInicio}–{s.horaFin} · {s.aulas.join(' / ')}{s.excluida && ` · Excluida: ${s.excluida}`}</span></label>
                    {!s.excluida && <label className="mt-2 block">Aula de esta sesión<select aria-label={`Aula ${g.siglas[0]} ${g.paralelo} ${s.dia} ${s.horaInicio}`} className="select-field mt-1" disabled={busy || Boolean(g.errores.length)} value={s.aula} onChange={e => changeRoom(g.key, i, e.target.value)}><option value="">Selecciona el aula registrada</option>{availableRooms.map(a => <option key={a.codigo} value={a.codigo}>{a.codigo} — {a.nombre}</option>)}</select></label>}
                    <p className="mt-1 text-xs text-slate-500">PDF, página {s.pagina}: {s.fuente}</p>
                  </div>)}
                  {selected.length > 0 && <button disabled={busy} className="btn-ghost" onClick={() => { invalidate(); setChoices(c => ({ ...c, [g.key]: [] })); }}>Omitir este paralelo</button>}
                </div>
              </details>;
            })}
          </div>
        </>}
      </>}
    </div>
  </Modal>;
}
