const DIAS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
export const diaDeFecha = (fecha: string) => DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay() - 1];
interface Vigencia { fecha: Date | null; inicio: Date; fin: Date; dia: string }
// Días y horas se comparan aparte. Comprueba que exista al menos una fecha
// real compartida, incluidas reservas puntuales y periodos diferentes.
export function compartenFecha(a: Vigencia, b: Vigencia) {
  if (a.dia !== b.dia) return false;
  const inicio = Math.max((a.fecha ?? a.inicio).getTime(), (b.fecha ?? b.inicio).getTime());
  const fin = Math.min((a.fecha ?? a.fin).getTime(), (b.fecha ?? b.fin).getTime());
  if (inicio > fin) return false;
  const date = new Date(inicio);
  const objetivo = DIAS.indexOf(a.dia) + 1;
  const salto = (objetivo - date.getUTCDay() + 7) % 7;
  return inicio + salto * 86400000 <= fin;
}
