import { useState } from "react";
import type { Horario } from "../../api/types";
import type { CatalogoHorario } from "../../api/estudiantes.api";
import type { PlannerContext } from "../schedule/planner";
const normalizarBusqueda = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();

export function SubjectsPanel({ subjects, lessons, selected, duration, onSelect, onDuration, onAdd, onRemove, onSchedule, catalog, loading, error, retry, context, onContext }: {
  subjects: string[]; lessons: Horario[]; selected: string; duration: number;
  onSelect: (subject: string) => void; onDuration: (hours: number) => void;
  onAdd: (subject: string) => void; onRemove: (subject: string) => void;
  onSchedule: () => void;
  catalog: CatalogoHorario | null; loading: boolean; error: boolean; retry: () => void;
  context: PlannerContext; onContext: (context: PlannerContext) => void;
}) {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const filtered = (catalog?.materias ?? []).filter(m => m.planes.some(p => p.mencion === context.mention && (context.semester === "electivas" ? p.semestre === null : String(p.semestre) === context.semester)))
    .filter(m => normalizarBusqueda(`${m.nombre} ${m.siglas.join(" ")}`).includes(normalizarBusqueda(query)))
    .sort((a, b) => (a.planes.find(p => p.mencion === context.mention)?.orden ?? 999) - (b.planes.find(p => p.mencion === context.mention)?.orden ?? 999));
  const semesters = [...new Set((catalog?.materias ?? []).flatMap(m => m.planes.filter(p => p.mencion === context.mention && p.semestre !== null).map(p => p.semestre!)))].sort((a, b) => a - b);
  const hasElectives = catalog?.materias.some(m => m.planes.some(p => p.mencion === context.mention && p.semestre === null));
  return <aside className="card planner-subjects p-5" aria-label="Materias que pienso cursar">
    <p className="planner-step">1 · Elige tus materias</p><h2 className="mt-2 text-lg font-bold">Tu plan de estudios</h2><p className="mt-2 text-sm leading-6 text-slate-500">Selecciona tu mención y semestre. Pulsa + en las materias que cursarás.</p>
    {loading ? <p role="status" className="my-4 text-sm">Cargando catálogo académico…</p> : error ? <div role="alert" className="planner-note mt-4">No pudimos cargar el catálogo. Tus horarios guardados siguen disponibles.<button className="planner-text-link mt-2" onClick={retry}>Reintentar</button></div> : catalog && <>
      <div className="planner-catalog-selectors">
        <label htmlFor="planner-mention">Mención<select id="planner-mention" value={context.mention} onChange={e => { onContext({ ...context, mention: e.target.value, semester: "" }); setQuery(""); }}><option value="">Selecciona tu mención</option>{catalog.menciones.map(m => <option value={m.id} key={m.id}>{m.nombre}</option>)}</select></label>
        <label htmlFor="planner-semester">Semestre de la malla<select id="planner-semester" disabled={!context.mention} value={context.semester} onChange={e => { onContext({ ...context, semester: e.target.value }); setQuery(""); }}><option value="">Selecciona el semestre</option>{semesters.map(s => <option key={s} value={s}>Semestre {s}</option>)}{hasElectives && <option value="electivas">Electivas</option>}</select></label>
        <label htmlFor="planner-period">Periodo académico<select id="planner-period" value={context.period?.id ?? ""} onChange={e => onContext({ ...context, period: catalog.periodos.find(p => p.id === e.target.value) })}><option value="">Selecciona el periodo</option>{context.period && !catalog.periodos.some(p => p.id === context.period!.id) && <option value={context.period.id}>{context.period.nombre} · Guardado</option>}{catalog.periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        {!catalog.periodos.length && <p className="text-xs text-slate-500">No hay periodos habilitados. Puedes preparar una versión y elegir el periodo más adelante.</p>}
      </div>
      {context.mention && context.semester && <div className="planner-catalog"><label htmlFor="planner-catalog-search" className="sr-only">Filtrar materias del catálogo</label><input id="planner-catalog-search" className="input-field" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar por nombre o sigla" /><p className="my-3 text-xs text-slate-500" role="status">{filtered.length} materias de tu selección</p><div className="planner-catalog-list">{filtered.map(m => { const existing = subjects.find(s => normalizarBusqueda(s) === normalizarBusqueda(m.nombre)); return <button key={m.nombre} disabled={!existing && subjects.length >= 100} aria-label={`${existing ? "Seleccionar" : "Añadir"} ${m.nombre} del catálogo`} onClick={() => existing ? onSelect(existing) : onAdd(m.nombre)}><span><small>{m.siglas.join(" · ")}</small><strong>{m.nombre}</strong></span><span aria-hidden="true">{existing ? "✓" : "+"}</span></button>; })}</div>{!filtered.length && <p className="text-sm text-slate-500">No hay materias para estos filtros.</p>}</div>}
      <p className="mt-3 text-xs leading-5 text-slate-500">Puedes cambiar de semestre para añadir materias de otros niveles. Tu lista se conserva.</p>
    </>}
    <div className="mt-6 border-t pt-5"><h3 className="font-bold">Mis materias ({subjects.length})</h3><div className="planner-subject-list mt-3">{subjects.map(subject => {
      const count = lessons.filter(h => h.materia === subject).length;
      return <div key={subject} className={`planner-subject-card${selected === subject ? " is-selected" : ""}`}><button className="planner-subject-select" aria-pressed={selected === subject} onClick={() => onSelect(subject)} aria-label={`Seleccionar ${subject}`}><strong>{subject}</strong><span>{count ? `${count} ${count === 1 ? "clase en tu horario" : "clases en tu horario"}` : "Sin clases todavía"}</span><span className="planner-subject-action">{selected === subject ? "✓ Seleccionada" : "Seleccionar materia →"}</span></button><button className="planner-subject-remove" aria-label={`Eliminar ${subject} de mi lista`} title="Eliminar de mi lista" onClick={() => onRemove(subject)}>×</button></div>;
    })}</div>{!subjects.length && <p className="planner-subject-empty">Las materias que elijas aparecerán aquí.</p>}</div>
    {selected && <div className="mt-5 border-t pt-4"><label htmlFor="subject-duration" className="mb-2 block text-xs font-semibold">Duración de la clase</label><select id="subject-duration" className="select-field" value={duration} onChange={e => onDuration(Number(e.target.value))}>{Array.from({ length: 15 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h} {h === 1 ? "hora" : "horas"}</option>)}</select><button className="btn-primary mt-3 w-full" onClick={onSchedule}>Elegir día y hora</button><p className="mt-2 text-xs leading-5 text-slate-500">Puedes añadir varias clases de la misma materia.</p></div>}
    <details className="mt-5 border-t pt-4 text-xs text-slate-500"><summary className="cursor-pointer">¿Falta una materia en el catálogo?</summary><form className="mt-3 space-y-3" onSubmit={e => { e.preventDefault(); const name = manual.trim(); if (!name) return; const match = subjects.find(s => normalizarBusqueda(s) === normalizarBusqueda(name)); if (match) onSelect(match); else onAdd(name); setManual(""); }}><label htmlFor="planned-subject">Añadir otra materia (opcional)</label><input id="planned-subject" className="input-field" required maxLength={300} value={manual} onChange={e => setManual(e.target.value)} /><button className="btn-secondary" disabled={subjects.length >= 100}>Agregar a mi lista</button></form></details>
  </aside>;
}
