import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DiaSemana, Horario } from "../../api/types";
import { useUserAuthStore } from "../../store/userAuthStore";
import { DIAS_SEMANA_LABEL } from "../../utils/formatters";
import { MAX_VERSIONS, Planner, emptyPlanner, findConflicts, groupCourses, hoursPerWeek, newVersion, readPlanner, savePlanner, storageKey } from "../schedule/planner";
import { LessonEditor, ManualSchedule } from "../components/ManualSchedule";
import { SubjectsPanel } from "../components/SubjectsPanel";
import "../../styles/schedule-planner.css";

export default function SchedulePlannerPage() {
  const userId = useUserAuthStore(s => s.usuario?.idUsuario);
  return userId ? <PlannerWorkspace key={userId} userId={userId} /> : null;
}

function PlannerWorkspace({ userId }: { userId: string }) {
  const [initial] = useState(() => {
    try { return { data: readPlanner(window.localStorage, userId), error: false }; }
    catch { return { data: emptyPlanner(), error: true }; }
  });
  const [planner, setPlanner] = useState<Planner>(initial.data);
  const [loadError, setLoadError] = useState(initial.error);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editor, setEditor] = useState<{ lesson: Horario; existing: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [duration, setDuration] = useState(1);

  // Other tabs follow saved changes; unsaved work is never replaced silently.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey(userId) && event.key !== null) return;
      if (saveError) { setNotice("Hay cambios en otra pestaña. Esta pestaña conserva tus cambios sin guardar."); return; }
      try {
        setPlanner(readPlanner(window.localStorage, userId)); setLoadError(false);
        setSaved(false); setEditingName(false); setEditor(null); setNotice("Se actualizaron las versiones desde otra pestaña.");
      } catch { setLoadError(true); }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [userId, saveError]);

  const version = planner.versions.find(v => v.id === planner.activeId)!;
  const selectedCourses = groupCourses(version.lessons);
  const conflicts = findConflicts(version.lessons);
  const activeSubject = version.subjects.includes(selectedSubject) ? selectedSubject : version.subjects[0] ?? "";

  function commit(next: Planner) {
    setPlanner(next); setNotice("");
    try { savePlanner(window.localStorage, userId, next); setSaveError(false); setSaved(true); }
    catch { setSaveError(true); setSaved(false); }
  }
  function updateLessons(lessons: Horario[]) {
    const subjects = [...new Set([...version.subjects, ...lessons.map(h => h.materia)])];
    if (subjects.length > 100) { setNotice("Esta versión admite hasta 100 materias. Elimina una de la lista antes de añadir otra."); return; }
    commit({ ...planner, versions: planner.versions.map(v => v.id === version.id ? { ...v, lessons, subjects } : v) });
  }
  function addVersion(duplicate: boolean) {
    if (planner.versions.length >= MAX_VERSIONS) return;
    const next = newVersion(duplicate ? `${version.name.slice(0, 52)} (copia)` : `Opción ${planner.versions.length + 1}`, duplicate ? version.lessons : [], duplicate ? version.subjects : []);
    commit({ ...planner, activeId: next.id, versions: [...planner.versions, next] }); setEditingName(false);
  }
  function createLesson(day: DiaSemana = "LUNES", time = "07:00", manual = false) {
    if (version.lessons.length >= 100) { setNotice("Esta versión admite hasta 100 clases. Crea otra versión para seguir planificando."); return; }
    const endHour = Number(time.slice(0, 2)) + (activeSubject && !manual ? duration : 1);
    if (endHour > 22) { setNotice("La clase terminaría después de las 22:00. Reduce su duración o elige una hora más temprana."); return; }
    const lesson: Horario = {
      idHorario: Math.max(0, ...version.lessons.map(h => h.idHorario)) + 1,
      materia: manual ? "" : activeSubject, docente: "", aula: "", grupo: "", dia: day,
      horaInicio: time, horaFin: `${String(endHour).padStart(2, "0")}:00`,
    };
    if (activeSubject && !manual) {
      if (version.lessons.some(h => h.materia === lesson.materia && h.dia === day && h.horaInicio === time && h.horaFin === lesson.horaFin)) return;
      updateLessons([...version.lessons, lesson]);
    } else setEditor({ existing: false, lesson });
  }

  if (loadError) return <div className="container-public py-12"><div role="alert" className="card space-y-4 p-6">
    <h1 className="text-2xl font-bold">No pudimos abrir tus horarios guardados</h1>
    <p>Los datos no se han sobrescrito. Comprueba que el navegador permita guardar datos e intenta recargar.</p>
    <div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={() => window.location.reload()}>Volver a intentar</button>
      <button className="btn-secondary" onClick={() => {
        if (!window.confirm("¿Reiniciar tus horarios en este navegador? Se eliminarán las versiones guardadas de esta cuenta.")) return;
        try { const fresh = emptyPlanner(); savePlanner(window.localStorage, userId, fresh); setPlanner(fresh); setLoadError(false); setSaved(true); }
        catch { setNotice("El navegador sigue sin permitir guardar datos."); }
      }}>Reiniciar horarios locales</button></div><p role="status">{notice}</p>
  </div></div>;

  return <div className="schedule-planner">
    <section className="planner-hero">
      <div className="container-public py-9">
        <Link to="/usuario/dashboard" className="text-sm text-teal-200 hover:underline">← Mi espacio</Link>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-200">Prepárate para la inscripción</p>
            <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Arma tu horario</h1>
            <p className="mt-3 leading-7 text-teal-100">Escribe tus materias, elige sus horas y organiza tu semana. Guarda distintas opciones antes de inscribirte.</p></div>
          <div className="planner-local-badge"><span aria-hidden="true">◉</span> Tu planificación personal</div>
        </div>
      </div>
    </section>
    <div className="container-public space-y-6 py-7">
      <div className="planner-note">Tus versiones se guardan automáticamente en este navegador y se conservan al cerrar sesión. No se sincronizan con otros dispositivos; borrar los datos del navegador las elimina. <strong>Armar un horario no reserva cupos ni realiza tu inscripción.</strong></div>
      {saveError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">No se pudieron guardar los últimos cambios. Se mantienen en esta pestaña, pero podrían perderse al cerrarla. <button className="ml-2 font-bold underline" onClick={() => commit(planner)}>Reintentar guardado</button></div>}
      <section className="card p-5" aria-label="Versiones de mi horario">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-800">Mis versiones <span className="ml-1 text-sm font-normal text-slate-500">{planner.versions.length}/{MAX_VERSIONS}</span></h2>
            <p role="status" className="mt-1 text-xs text-slate-500">{saveError ? "Cambios sin guardar" : saved ? "✓ Guardado en este navegador" : "Guardado automático al hacer cambios"}</p></div>
          <button className="btn-primary" disabled={planner.versions.length >= MAX_VERSIONS} onClick={() => addVersion(false)}>+ Nueva versión</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Elegir versión">{planner.versions.map(v => <button key={v.id} aria-pressed={v.id === version.id} className="planner-version" onClick={() => { commit({ ...planner, activeId: v.id }); setEditingName(false); }}>{v.name}<span>{v.subjects.length} materias</span></button>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {editingName ? <form className="flex w-full flex-wrap gap-2 sm:w-auto" onSubmit={e => {
            e.preventDefault(); if (!name.trim()) return;
            commit({ ...planner, versions: planner.versions.map(v => v.id === version.id ? { ...v, name: name.trim() } : v) }); setEditingName(false);
          }}><label className="sr-only" htmlFor="version-name">Nombre de la versión</label><input id="version-name" autoFocus required maxLength={60} className="input-field sm:!w-64" value={name} onChange={e => setName(e.target.value)} /><button className="btn-primary" disabled={!name.trim()}>Guardar nombre</button><button type="button" className="btn-ghost" onClick={() => setEditingName(false)}>Cancelar</button></form> : <button className="btn-ghost" onClick={() => { setName(version.name); setEditingName(true); }}>Cambiar nombre</button>}
          <button className="btn-ghost" disabled={planner.versions.length >= MAX_VERSIONS} onClick={() => addVersion(true)}>Duplicar versión</button>
          <button className="btn-ghost !text-red-700" onClick={() => {
            if (!window.confirm(`¿Eliminar la versión «${version.name}»? Esta acción no se puede deshacer.`)) return;
            const remaining = planner.versions.filter(v => v.id !== version.id);
            commit(remaining.length ? { ...planner, activeId: remaining[0].id, versions: remaining } : emptyPlanner()); setEditingName(false);
          }}>Eliminar versión</button>
        </div>
      </section>
      {notice && <p role="status" className="planner-note">{notice}</p>}
      <div className="planner-workspace">
      <SubjectsPanel key={version.id} subjects={version.subjects} lessons={version.lessons} selected={activeSubject} duration={duration} onSelect={setSelectedSubject} onDuration={setDuration} onAdd={subject => {
        if (version.subjects.length >= 100) return;
        commit({ ...planner, versions: planner.versions.map(v => v.id === version.id ? { ...v, subjects: [...v.subjects, subject] } : v) }); setSelectedSubject(subject);
      }} onRemove={subject => {
        const scheduled = version.lessons.some(h => h.materia === subject);
        if (!window.confirm(scheduled ? `¿Eliminar «${subject}» de esta versión y todas sus clases del horario?` : `¿Eliminar «${subject}» de tu lista?`)) return;
        commit({ ...planner, versions: planner.versions.map(v => v.id === version.id ? { ...v, subjects: v.subjects.filter(s => s !== subject), lessons: v.lessons.filter(h => h.materia !== subject) } : v) });
      }} />
      <section className="min-w-0 space-y-5" aria-label="Mi semana">
        <div className="planner-stats"><div><strong>{selectedCourses.length}</strong><span>Materias en horario</span></div><div><strong>{hoursPerWeek(version.lessons).toLocaleString("es", { maximumFractionDigits: 1 })}</strong><span>Horas por semana</span></div><div><strong>{conflicts.length}</strong><span>Cruces de horario</span></div></div>
        {conflicts.length > 0 && <div role="status" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Hay clases que coinciden</strong><ul className="mt-2 space-y-1">{conflicts.map(({ a, b }) => <li key={`${a.idHorario}-${b.idHorario}`}>{DIAS_SEMANA_LABEL[a.dia]}: {a.materia} ({a.horaInicio}–{a.horaFin}) y {b.materia} ({b.horaInicio}–{b.horaFin}).</li>)}</ul><p className="mt-2">Pulsa una materia para cambiar su hora o eliminar esa clase.</p></div>}
        <div className="card min-w-0 p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="break-words text-xl font-bold text-slate-800">{version.name}</h2><p className="mt-1 text-sm text-slate-500">Selecciona una materia de tu lista y pulsa una hora. Pulsa una clase para editarla.</p></div><button className="btn-secondary" onClick={() => createLesson("LUNES", "07:00", true)}>+ Clase manual</button></div>
          {activeSubject && <p role="status" className="planner-placement-note mb-4"><strong>{activeSubject}</strong><span>Lista para colocar · {duration} {duration === 1 ? "hora" : "horas"} · Pulsa una casilla libre</span></p>}
          <p className="mb-4 text-xs text-slate-500">Lunes a sábado · 07:00 a 22:00 · Intervalos de una hora. En el celular, desliza la cuadrícula para ver todos los días.</p>
          <ManualSchedule lessons={version.lessons} onCreate={createLesson} onEdit={lesson => setEditor({ lesson, existing: true })} />
          {version.lessons.some(h => h.horaInicio < "07:00" || h.horaFin > "22:00") && <div className="mt-4 text-sm text-amber-800"><p>Estas clases guardadas incluyen horas fuera de la cuadrícula. Puedes editarlas para ajustarlas:</p>{version.lessons.filter(h => h.horaInicio < "07:00" || h.horaFin > "22:00").map(h => <button key={h.idHorario} className="btn-ghost" onClick={() => setEditor({ existing: true, lesson: { ...h, horaInicio: "07:00", horaFin: "08:00" } })}>{h.materia} · {h.horaInicio}–{h.horaFin}</button>)}</div>}
        </div>
      </section>
      </div>
    </div>
    {editor && <LessonEditor initial={editor.lesson} existing={editor.existing} onClose={() => setEditor(null)} onSave={lesson => {
      updateLessons(editor.existing ? version.lessons.map(h => h.idHorario === lesson.idHorario ? lesson : h) : [...version.lessons, lesson]); setEditor(null);
    }} onDelete={() => {
      if (!window.confirm(`¿Eliminar la clase de ${editor.lesson.materia} del ${DIAS_SEMANA_LABEL[editor.lesson.dia]}?`)) return;
      updateLessons(version.lessons.filter(h => h.idHorario !== editor.lesson.idHorario)); setEditor(null);
    }} />}
  </div>;
}
