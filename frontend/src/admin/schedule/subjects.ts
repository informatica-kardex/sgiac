import type { Materia } from '../../api/academico.api';
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
export function subjectPosition(materia: Materia, mencion = '') {
  const planes = (materia.planes ?? []).filter(p => !mencion || p.mencion === mencion);
  const semestrales = planes.filter(p => p.semestre !== null);
  return { semestre: average(semestrales.map(p => p.semestre!)),
    orden: average((semestrales.length ? semestrales : planes).map(p => p.orden)),
    asignada: planes.length > 0 };
}
export function filterSubjects(materias: Materia[], mencion: string, query: string) {
  const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return materias.filter(m => (!mencion || m.planes?.some(p => p.mencion === mencion)) &&
    normal(`${m.nombre} ${m.siglas.join(' ')}`).includes(normal(query.trim()))).sort((a, b) => {
      const x = subjectPosition(a, mencion), y = subjectPosition(b, mencion);
      return (x.semestre ?? (x.asignada ? 10 : 11)) - (y.semestre ?? (y.asignada ? 10 : 11)) ||
        (x.orden ?? 999) - (y.orden ?? 999) || a.nombre.localeCompare(b.nombre, 'es') || a.codigo.localeCompare(b.codigo);
    });
}
