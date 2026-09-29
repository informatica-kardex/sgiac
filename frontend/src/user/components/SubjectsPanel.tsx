import { useState } from "react";
import type { Horario } from "../../api/types";

export function SubjectsPanel({ subjects, lessons, selected, duration, onSelect, onDuration, onAdd, onRemove }: {
  subjects: string[]; lessons: Horario[]; selected: string; duration: number;
  onSelect: (subject: string) => void; onDuration: (hours: number) => void;
  onAdd: (subject: string) => void; onRemove: (subject: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return <aside className="card planner-subjects p-5" aria-label="Materias que pienso cursar">
    <span className="planner-subject-icon" aria-hidden="true">＋</span>
    <h2 className="mt-3 text-lg font-bold text-slate-800">Mis materias</h2>
    <p className="mt-1 text-sm leading-6 text-slate-500">Escribe las materias que piensas cursar. Selecciona una y pulsa una hora para colocarla en tu semana.</p>
    <form className="mt-5 space-y-2" onSubmit={e => {
      e.preventDefault(); const value = name.trim();
      if (!value) { setError("Escribe el nombre de la materia."); return; }
      const match = subjects.find(s => s.toLocaleLowerCase() === value.toLocaleLowerCase());
      if (match) { onSelect(match); setError("Esta materia ya está en tu lista. La seleccionamos para que la coloques en el horario."); return; }
      onAdd(value); setName(""); setError("");
    }}>
      <label htmlFor="planned-subject" className="block text-xs font-semibold text-slate-600">Materia que quieres cursar</label>
      <input id="planned-subject" required maxLength={300} className="input-field" placeholder="Ej. Programación I" value={name} onChange={e => { setName(e.target.value); setError(""); }} />
      <button className="btn-primary w-full" disabled={subjects.length >= 100}>+ Agregar a mi lista</button>
      {error && <p role="status" className="text-xs text-amber-800">{error}</p>}
      {subjects.length >= 100 && <p className="text-xs text-slate-500">Alcanzaste el límite de 100 materias por versión.</p>}
    </form>
    <div className="mt-5 flex items-center justify-between text-xs text-slate-500"><span>{subjects.length} materias en esta versión</span><span>Selecciona una ↓</span></div>
    <div className="planner-subject-list mt-3">{subjects.map(subject => {
      const count = lessons.filter(h => h.materia === subject).length;
      return <div key={subject} className={`planner-subject-card${selected === subject ? " is-selected" : ""}`}>
        <button className="planner-subject-select" aria-pressed={selected === subject} onClick={() => onSelect(subject)} aria-label={`Seleccionar ${subject}`}>
          <strong>{subject}</strong><span>{count ? `${count} ${count === 1 ? "clase en tu horario" : "clases en tu horario"}` : "Pendiente de colocar"}</span>
          <span className="planner-subject-action">{selected === subject ? "✓ Seleccionada · Pulsa una hora" : "Seleccionar materia →"}</span>
        </button>
        <button className="planner-subject-remove" aria-label={`Eliminar ${subject} de mi lista`} title="Eliminar de mi lista" onClick={() => onRemove(subject)}>×</button>
      </div>;
    })}</div>
    {!subjects.length && <p className="planner-subject-empty">Tu lista empieza aquí. Añade tu primera materia para organizar la semana.</p>}
    <div className="mt-5 border-t border-slate-100 pt-4">
      <label htmlFor="subject-duration" className="mb-2 block text-xs font-semibold text-slate-600">Duración de cada clase</label>
      <select id="subject-duration" className="select-field" value={duration} onChange={e => onDuration(Number(e.target.value))}>{Array.from({ length: 15 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h} {h === 1 ? "hora" : "horas"}</option>)}</select>
      <p className="mt-2 text-xs leading-5 text-slate-500">Puedes colocar la misma materia en varios días y editar cada bloque después.</p>
    </div>
  </aside>;
}
