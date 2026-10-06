import catalogo from './data/planes-estudio.json';

export const menciones = catalogo.menciones;
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const porNombre = new Map(catalogo.materias.map(m => [normalizar(m.nombre), m]));
export function datosPlan(nombre: string) {
  // Match by name: INF-244 is both Base de Datos II and Robótica. Prefixes
  // cannot establish membership: shared INF courses differ across mentions.
  const planes = porNombre.get(normalizar(nombre))?.planes.map(p => ({
    mencion: p.mencion, semestre: p.semestre, orden: p.orden,
  })) ?? [];
  const semestrales = planes.filter(p => p.semestre !== null);
  const promedio = (values: number[]) => values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
  return { planes, semestrePromedio: promedio(semestrales.map(p => p.semestre!)),
    ordenPromedio: promedio((semestrales.length ? semestrales : planes).map(p => p.orden)) };
}

export function compararPlanes(a: ReturnType<typeof datosPlan> & { nombre: string; codigo: string }, b: ReturnType<typeof datosPlan> & { nombre: string; codigo: string }) {
  return (a.semestrePromedio ?? (a.planes.length ? 10 : 11)) - (b.semestrePromedio ?? (b.planes.length ? 10 : 11)) ||
    (a.ordenPromedio ?? 999) - (b.ordenPromedio ?? 999) || a.nombre.localeCompare(b.nombre, 'es') || a.codigo.localeCompare(b.codigo);
}
