import { z } from "zod";
import type { Horario } from "../../api/types";

export const DAYS = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"] as const;
export const MAX_VERSIONS = 20;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const lessonSchema = z.object({
  idHorario: z.number().int().positive(), materia: z.string().max(300),
  docente: z.string().max(300), aula: z.string().max(300), grupo: z.string().max(100),
  dia: z.enum(DAYS), horaInicio: time, horaFin: time,
}).refine(h => h.horaInicio < h.horaFin);
const versionSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1).max(60),
  lessons: z.array(lessonSchema).max(100),
  subjects: z.array(z.string().trim().min(1).max(300)).max(100).optional(),
  context: z.object({
    mention: z.string().max(100), semester: z.string().max(20),
    period: z.object({ id: z.string(), nombre: z.string().max(100), desde: z.string(), hasta: z.string() }).optional(),
  }).optional(),
}).transform(v => ({ ...v, subjects: v.subjects ?? [...new Set(v.lessons.map(h => h.materia.trim()).filter(Boolean))] }));
const plannerSchema = z.object({
  schema: z.literal(1), activeId: z.string(), versions: z.array(versionSchema).min(1).max(MAX_VERSIONS),
  preferredId: z.string().optional(),
}).refine(p => new Set(p.versions.map(v => v.id)).size === p.versions.length
  && p.versions.some(v => v.id === p.activeId)
  && (!p.preferredId || p.versions.some(v => v.id === p.preferredId))
  && p.versions.every(v => new Set(v.lessons.map(h => h.idHorario)).size === v.lessons.length));

export type ScheduleVersion = z.infer<typeof versionSchema>;
export type PlannerContext = NonNullable<ScheduleVersion["context"]>;
export type Planner = z.infer<typeof plannerSchema>;
export const storageKey = (userId: string) => `sgiac:student-schedules:v1:${encodeURIComponent(userId)}`;
export const newVersion = (name: string, lessons: Horario[] = [], subjects = [...new Set(lessons.map(h => h.materia))]): ScheduleVersion => ({
  id: crypto.randomUUID(), name, lessons: lessons.map(h => ({ ...h })), subjects: [...subjects],
});
export function emptyPlanner(): Planner {
  const version = newVersion("Mi primera opción");
  return { schema: 1, activeId: version.id, versions: [version] };
}
export function readPlanner(storage: Pick<Storage, "getItem">, userId: string): Planner {
  const raw = storage.getItem(storageKey(userId));
  return raw === null ? emptyPlanner() : plannerSchema.parse(JSON.parse(raw));
}
export function savePlanner(storage: Pick<Storage, "setItem">, userId: string, planner: Planner) {
  storage.setItem(storageKey(userId), JSON.stringify(plannerSchema.parse(planner)));
}
export const courseKey = (h: Horario) => JSON.stringify([h.materia, h.grupo]);
export function groupCourses(lessons: Horario[]) {
  const groups = new Map<string, Horario[]>();
  lessons.forEach(h => { const key = courseKey(h); groups.set(key, [...(groups.get(key) ?? []), h]); });
  return [...groups.entries()].map(([key, slots]) => ({ key, slots, materia: slots[0].materia, grupo: slots[0].grupo }));
}
export const overlaps = (a: Horario, b: Horario) => a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;
export function findConflicts(lessons: Horario[]) {
  return lessons.flatMap((a, i) => lessons.slice(i + 1).filter(b => overlaps(a, b)).map(b => ({ a, b })));
}
export function hoursPerWeek(lessons: Horario[]) {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return lessons.reduce((sum, h) => sum + minutes(h.horaFin) - minutes(h.horaInicio), 0) / 60;
}

export function chooseSemesterSchedule(planner: Planner, versionId: string): Planner {
  const version = planner.versions.find(v => v.id === versionId);
  if (!version?.lessons.length) throw new Error("Añade al menos una clase a tu semana.");
  if (!version.context?.period) throw new Error("Selecciona el periodo académico de este horario.");
  if (findConflicts(version.lessons).length) throw new Error("Resuelve los cruces antes de elegir tu horario del semestre.");
  return { ...planner, preferredId: versionId };
}
