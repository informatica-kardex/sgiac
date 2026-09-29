import { useEffect, useRef, useState } from "react";
import type { DiaSemana, Horario } from "../../api/types";
import { DIAS_SEMANA_LABEL } from "../../utils/formatters";
import { DAYS, overlaps } from "../schedule/planner";

export const HOURS = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const position = (time: string) => (minutes(time) - 420) / 60 * 88;

export function ManualSchedule({ lessons, onCreate, onEdit }: {
  lessons: Horario[]; onCreate: (day: DiaSemana, time: string) => void; onEdit: (lesson: Horario) => void;
}) {
  return <div className="planner-timetable-scroll" tabIndex={0} role="region" aria-label="Horario semanal de 07:00 a 22:00. Desplaza horizontalmente para ver todos los días.">
    <div className="planner-timetable">
      <div className="planner-time-heading">Hora</div>
      {DAYS.map(day => <h3 key={day} className="planner-day-heading">{DIAS_SEMANA_LABEL[day]}</h3>)}
      <div className="planner-time-axis">{HOURS.map(time => <span key={time} style={{ top: position(time) }}>{time}</span>)}</div>
      {DAYS.map(day => {
        const daily = lessons.filter(h => h.dia === day && h.horaInicio < "22:00" && h.horaFin > "07:00").sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        const lanes: Horario[][] = [];
        const placed = daily.map(h => {
          let lane = lanes.findIndex(items => items.every(other => !overlaps(h, other)));
          if (lane < 0) { lane = lanes.length; lanes.push([]); }
          lanes[lane].push(h);
          return { h, lane };
        });
        return <div key={day} className="planner-day-column">
          {HOURS.slice(0, -1).map(time => <button key={time} className="planner-hour-cell" aria-label={`Añadir materia: ${DIAS_SEMANA_LABEL[day]}, ${time}`} onClick={() => onCreate(day, time)}><span aria-hidden="true">+</span></button>)}
          {placed.map(({ h, lane }) => {
            const clash = daily.some(other => other.idHorario !== h.idHorario && overlaps(h, other));
            const columns = clash ? lanes.length : 1;
            const start = h.horaInicio < "07:00" ? "07:00" : h.horaInicio;
            const end = h.horaFin > "22:00" ? "22:00" : h.horaFin;
            return <button key={h.idHorario} className={`planner-time-block${clash ? " has-conflict" : ""}`} style={{ top: position(start) + 2, height: Math.max(20, position(end) - position(start) - 4), left: `calc(${(clash ? lane : 0) / columns * 100}% + 3px)`, width: `calc(${100 / columns}% - 6px)` }} onClick={() => onEdit(h)} aria-label={`Editar ${h.materia}, ${DIAS_SEMANA_LABEL[day]}, ${h.horaInicio} a ${h.horaFin}`}>
              <span className="planner-block-time">{h.horaInicio}–{h.horaFin}</span><strong>{h.materia}</strong>
              {(h.aula || h.grupo) && <span>{[h.aula, h.grupo && `Grupo ${h.grupo}`].filter(Boolean).join(" · ")}</span>}
              {h.docente && <span>{h.docente}</span>}{clash && <span className="font-bold">Cruce de horario</span>}
            </button>;
          })}
        </div>;
      })}
    </div>
  </div>;
}

export function LessonEditor({ initial, existing, onSave, onDelete, onClose }: {
  initial: Horario; existing: boolean; onSave: (lesson: Horario) => void; onDelete: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => { const el = dialog.current; el?.showModal(); return () => el?.close(); }, []);
  const update = (values: Partial<Horario>) => { setDraft(d => ({ ...d, ...values })); setError(""); };
  // Retain existing half-hour classes from previously saved versions.
  const times = [...new Set([...HOURS, initial.horaInicio, initial.horaFin])].filter(t => t >= "07:00" && t <= "22:00").sort();
  return <dialog ref={dialog} className="planner-dialog" aria-labelledby="lesson-editor-title" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      if (!draft.materia.trim()) { setError("Escribe el nombre de la materia."); return; }
      if (draft.horaInicio < "07:00" || draft.horaFin > "22:00" || draft.horaInicio >= draft.horaFin) { setError("Elige un intervalo entre 07:00 y 22:00, con la hora final posterior al inicio."); return; }
      onSave({ ...draft, materia: draft.materia.trim(), docente: draft.docente.trim(), aula: draft.aula.trim(), grupo: draft.grupo.trim() });
    }}>
      <div className="flex items-center justify-between gap-3"><h2 id="lesson-editor-title" className="text-xl font-bold">{existing ? "Editar materia" : "Añadir materia"}</h2><button type="button" className="btn-ghost" aria-label="Cerrar editor" onClick={onClose}>✕</button></div>
      <label className="block text-sm font-medium">Materia<input autoFocus required maxLength={300} className="input-field mt-1" value={draft.materia} onChange={e => update({ materia: e.target.value })} placeholder="Ej. Programación I" /></label>
      <label className="block text-sm font-medium">Día<select className="select-field mt-1" value={draft.dia} onChange={e => update({ dia: e.target.value as DiaSemana })}>{DAYS.map(d => <option key={d} value={d}>{DIAS_SEMANA_LABEL[d]}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium">Desde<select className="select-field mt-1" value={draft.horaInicio} onChange={e => {
          const start = e.target.value;
          update({ horaInicio: start, ...(start >= draft.horaFin ? { horaFin: times.find(t => t > start) ?? "22:00" } : {}) });
        }}>{times.filter(t => t < "22:00").map(t => <option key={t}>{t}</option>)}</select></label>
        <label className="block text-sm font-medium">Hasta<select className="select-field mt-1" value={draft.horaFin} onChange={e => update({ horaFin: e.target.value })}>{times.filter(t => t > draft.horaInicio).map(t => <option key={t}>{t}</option>)}</select></label>
      </div>
      <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium">Aula <span className="text-xs text-slate-500">(opcional)</span><input maxLength={300} className="input-field mt-1" value={draft.aula} onChange={e => update({ aula: e.target.value })} /></label><label className="block text-sm font-medium">Grupo <span className="text-xs text-slate-500">(opcional)</span><input maxLength={100} className="input-field mt-1" value={draft.grupo} onChange={e => update({ grupo: e.target.value })} /></label></div>
      <label className="block text-sm font-medium">Docente <span className="text-xs text-slate-500">(opcional)</span><input maxLength={300} className="input-field mt-1" value={draft.docente} onChange={e => update({ docente: e.target.value })} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t pt-4"><button className="btn-primary">{existing ? "Guardar cambios" : "Añadir materia"}</button><button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>{existing && <button type="button" className="btn-ghost !text-red-700" onClick={onDelete}>Eliminar clase</button>}</div>
    </form>
  </dialog>;
}
