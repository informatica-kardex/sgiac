import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { DiaSemana, Horario } from "../../api/types";
import { useUserAuthStore } from "../../store/userAuthStore";
import { DIAS_SEMANA_LABEL } from "../../utils/formatters";
import { MAX_VERSIONS, Planner, emptyPlanner, findConflicts, groupCourses, hoursPerWeek, newVersion, readPlanner, savePlanner, storageKey, chooseSemesterSchedule } from "../schedule/planner";
import { CatalogoHorario, estudiantesApi } from "../../api/estudiantes.api";
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
  const [selectedDay, setSelectedDay] = useState(() => window.matchMedia("(max-width: 639px)").matches ? "LUNES" : "");
  const [catalog, setCatalog] = useState<CatalogoHorario | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  useEffect(() => {
    let active = true; setCatalogLoading(true); setCatalogError(false);
    estudiantesApi.catalogoHorario().then(({ data }) => { if (active) setCatalog(data.data); })
      .catch(() => { if (active) setCatalogError(true); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [catalogAttempt]);

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
  const preferredHint = !version.lessons.length ? "Añade al menos una clase para elegir este horario." : !version.context?.period ? "Selecciona el periodo académico en tu plan de estudios." : conflicts.length ? "Resuelve los cruces de horario antes de elegir esta versión." : "";

  function commit(next: Planner) {
    const preferred = next.versions.find(v => v.id === next.preferredId);
    const invalidated = !!preferred && (!preferred.lessons.length || !preferred.context?.period || findConflicts(preferred.lessons).length > 0);
    if (invalidated) next = { ...next, preferredId: undefined };
    setPlanner(next); setNotice(invalidated ? "Tu horario elegido cambió y necesita revisión. Cuando esté listo, vuelve a marcarlo como horario del semestre." : "");
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
    if (version.context) next.context = { ...version.context };
    commit({ ...planner, activeId: next.id, versions: [...planner.versions, next] }); setEditingName(false);
  }
  function createLesson(day: DiaSemana = "LUNES", time = "07:00", openEditor = false) {
    if (!activeSubject) { setNotice("Primero elige una materia del catálogo. Después pulsa Añadir clase para elegir el día y la hora."); return; }
    if (version.lessons.length >= 100) { setNotice("Esta versión admite hasta 100 clases. Crea otra versión para seguir planificando."); return; }
    const endHour = Number(time.slice(0, 2)) + duration;
    if (endHour > 22) { setNotice("La clase terminaría después de las 22:00. Reduce su duración o elige una hora más temprana."); return; }
    const lesson: Horario = {
      idHorario: Math.max(0, ...version.lessons.map(h => h.idHorario)) + 1,
      materia: activeSubject, docente: "", aula: "", grupo: "", dia: day,
      horaInicio: time, horaFin: `${String(endHour).padStart(2, "0")}:00`,
    };
    if (!openEditor) {
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
            <p className="mt-3 leading-7 text-teal-100">Elige tus materias, indica cuándo tienes clases y guarda tu horario del semestre.</p></div>
          <div className="planner-local-badge"><span aria-hidden="true">◉</span> Tu planificación personal</div>
        </div>
      </div>
    </section>
    <div className="container-public space-y-6 py-7">
      <p className="planner-note">Guardado automático en este navegador, incluso al cerrar sesión. No se sincroniza entre dispositivos; borrar los datos del navegador elimina tus horarios. <strong>Es una planificación personal, no una inscripción oficial.</strong></p>
      {saveError && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">No se pudieron guardar los últimos cambios. Se mantienen en esta pestaña, pero podrían perderse al cerrarla. <button className="ml-2 font-bold underline" onClick={() => commit(planner)}>Reintentar guardado</button></div>}
      <section className="card p-5" aria-label="Versiones de mi horario">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-800">{version.name}</h2>
            <p role="status" className="mt-1 text-xs text-slate-500">{saveError ? "Cambios sin guardar" : saved ? "✓ Guardado en este navegador" : "Guardado automático al hacer cambios"}</p></div>
        </div>
        <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-primary-700">Otras versiones y opciones ({planner.versions.length}/{MAX_VERSIONS})</summary>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Elegir versión">{planner.versions.map(v => <button key={v.id} aria-pressed={v.id === version.id} className="planner-version" onClick={() => { commit({ ...planner, activeId: v.id }); setEditingName(false); }}>{v.name}<span>{v.subjects.length} materias</span></button>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button className="btn-secondary" disabled={planner.versions.length >= MAX_VERSIONS} onClick={() => addVersion(false)}>+ Nueva versión</button>
          {editingName ? <form className="flex w-full flex-wrap gap-2 sm:w-auto" onSubmit={e => {
            e.preventDefault(); if (!name.trim()) return;
            commit({ ...planner, versions: planner.versions.map(v => v.id === version.id ? { ...v, name: name.trim() } : v) }); setEditingName(false);
          }}><label className="sr-only" htmlFor="version-name">Nombre de la versión</label><input id="version-name" autoFocus required maxLength={60} className="input-field sm:!w-64" value={name} onChange={e => setName(e.target.value)} /><button className="btn-primary" disabled={!name.trim()}>Guardar nombre</button><button type="button" className="btn-ghost" onClick={() => setEditingName(false)}>Cancelar</button></form> : <button className="btn-ghost" onClick={() => { setName(version.name); setEditingName(true); }}>Cambiar nombre</button>}
          <button className="btn-ghost" disabled={planner.versions.length >= MAX_VERSIONS} onClick={() => addVersion(true)}>Duplicar versión</button>
          <button className="btn-ghost !text-red-700" onClick={() => {
            if (!window.confirm(`¿Eliminar la versión «${version.name}»? Esta acción no se puede deshacer.`)) return;
            const remaining = planner.versions.filter(v => v.id !== version.id);
            commit(remaining.length ? { ...planner, activeId: remaining[0].id, versions: remaining, preferredId: planner.preferredId === version.id ? undefined : planner.preferredId } : emptyPlanner()); setEditingName(false);
          }}>Eliminar versión</button>
        </div></details>
      </section>
      {notice && <p role="status" className="planner-note">{notice}</p>}
      <div className="planner-workspace">
      <SubjectsPanel onSchedule={() => createLesson((selectedDay || "LUNES") as DiaSemana, "07:00", true)} key={version.id} catalog={catalog} loading={catalogLoading} error={catalogError} retry={() => setCatalogAttempt(a => a + 1)} context={version.context ?? { mention: "", semester: "" }} onContext={context => commit({ ...planner, versions: planner.versions.map(v => v.id === version.id ? { ...v, context } : v) })} subjects={version.subjects} lessons={version.lessons} selected={activeSubject} duration={duration} onSelect={setSelectedSubject} onDuration={setDuration} onAdd={subject => {
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="planner-step">2 · Organiza tu semana</p><h2 className="mt-2 break-words text-xl font-bold text-slate-800">Mis clases</h2><p className="mt-1 text-sm text-slate-500">Añade una clase eligiendo su día y hora. Pulsa un bloque para editarlo.</p></div><button className="btn-primary" disabled={!activeSubject} onClick={() => createLesson((selectedDay || "LUNES") as DiaSemana, "07:00", true)}>+ Añadir clase</button></div>
          {activeSubject ? <p role="status" className="planner-placement-note mb-4"><strong>{activeSubject}</strong><span>Pulsa Añadir clase o una casilla de la semana · {duration} {duration === 1 ? "hora" : "horas"}</span></p> : <p className="planner-subject-empty mb-4">Comienza eligiendo tu mención, semestre y una materia del catálogo.</p>}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><label className="text-xs font-semibold text-slate-600" htmlFor="planner-view-day">Ver día <select id="planner-view-day" className="select-field ml-2 !w-auto" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}><option value="">Semana completa</option>{["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"].map(d => <option key={d} value={d}>{DIAS_SEMANA_LABEL[d]}</option>)}</select></label><Link to="/usuario/horarios" className="planner-text-link">Consultar horarios publicados ↗</Link></div>
          <p className="mb-4 text-xs text-slate-500">07:00 a 22:00 · Elige un día para trabajar con más espacio o explora la semana completa.</p>
          <ManualSchedule lessons={version.lessons} selectedDay={selectedDay} onCreate={createLesson} onEdit={lesson => setEditor({ lesson, existing: true })} />
          {version.lessons.some(h => h.horaInicio < "07:00" || h.horaFin > "22:00") && <div className="mt-4 text-sm text-amber-800"><p>Estas clases guardadas incluyen horas fuera de la cuadrícula. Puedes editarlas para ajustarlas:</p>{version.lessons.filter(h => h.horaInicio < "07:00" || h.horaFin > "22:00").map(h => <button key={h.idHorario} className="btn-ghost" onClick={() => setEditor({ existing: true, lesson: { ...h, horaInicio: "07:00", horaFin: "08:00" } })}>{h.materia} · {h.horaInicio}–{h.horaFin}</button>)}</div>}
        </div>
      </section>
      </div>
      <section className={`planner-preferred${planner.preferredId === version.id ? " is-chosen" : ""}`} aria-label="Horario elegido para el semestre"><div><p className="planner-step">3 · Elige tu horario del semestre</p><h2>{planner.preferredId === version.id ? "✓ Este es tu horario del semestre" : "¿Ya elegiste tu mejor opción?"}</h2><p>{planner.preferredId === version.id ? `${version.context?.period?.nombre ?? ""} · Lo verás al entrar a tu inicio en este navegador.` : "Márcala para ver tus clases al entrar al portal. Puedes cambiarla cuando necesites."}</p><small>Es tu planificación personal; no confirma una inscripción oficial.</small>{preferredHint && <p>{preferredHint}</p>}</div><button className="btn-primary" disabled={saveError || (!!preferredHint && planner.preferredId !== version.id)} onClick={() => {
        if (planner.preferredId === version.id) { commit({ ...planner, preferredId: undefined }); return; }
        try { commit(chooseSemesterSchedule(planner, version.id)); } catch (e) { setNotice((e as Error).message); }
      }}>{planner.preferredId === version.id ? "Dejar de usar como mi horario" : "Usar como mi horario del semestre"}</button></section>
    </div>
    {editor && <LessonEditor initial={editor.lesson} subjects={version.subjects} existing={editor.existing} onClose={() => setEditor(null)} onSave={lesson => {
      updateLessons(editor.existing ? version.lessons.map(h => h.idHorario === lesson.idHorario ? lesson : h) : [...version.lessons, lesson]); setEditor(null);
    }} onDelete={() => {
      if (!window.confirm(`¿Eliminar la clase de ${editor.lesson.materia} del ${DIAS_SEMANA_LABEL[editor.lesson.dia]}?`)) return;
      updateLessons(version.lessons.filter(h => h.idHorario !== editor.lesson.idHorario)); setEditor(null);
    }} />}
  </div>;
}
