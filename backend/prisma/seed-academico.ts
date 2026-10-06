import { prisma } from '../src/database/prisma';
import { academicoService as s } from '../src/modules/academico/academico.service';
import { AulaRepository } from '../src/modules/aulas/aula.repository';
import { HorarioRepository } from '../src/modules/horarios/horario.repository';

// Muestra del PDF HORARIOS PASANTES PRACTICA PARA COLAR, páginas 1, 2, 7 y 8.
// No inventa contactos ni capacidades. La ubicación por piso sigue los prefijos
// SS/PB/Pn del documento; el piso del edificio antiguo no está confirmado.
async function main() {
  let period = (await s.periodos()).find(p => p.gestion === 2026 && p.periodo === 'II');
  if (!period) { await s.crearPeriodo({ gestion: 2026, periodo: 'II', fechaInicio: '2026-07-01', fechaFin: '2026-12-31' }); period = (await s.periodos()).find(p => p.gestion === 2026 && p.periodo === 'II'); }
  if (!period) throw new Error('No se encontró el periodo de prueba');
  const materias = [
    { codigo: 'INF-111', nombre: 'Programación I', siglas: [] },
    { codigo: 'INF-112', nombre: 'Fundamentos Digitales', siglas: [] },
    { codigo: 'INF-124', nombre: 'Estadística I', siglas: [] },
    { codigo: 'INF-125', nombre: 'Álgebra Lineal', siglas: [] },
    { codigo: 'INF-381', nombre: 'Simulación de Sistemas', siglas: ['DAT-318'] },
  ];
  const existing = await s.materias();
  for (const m of materias) if (!existing.some(row => row.codigo === m.codigo)) await s.guardarMateria(m);
  const names = ['JHONNY ROBERTO FELIPEZ ANDRADE', 'NANCY IMELDA ORIHUELA SEQUEIROS', 'VERONICA CUENCA RAMALLO', 'ZENON CONDORI GONZALES', 'ROSA FLORES MORALES'];
  const teachers = await s.docentes();
  for (const nombreCompleto of names) if (!teachers.some(d => d.nombreCompleto === nombreCompleto)) await s.guardarDocente({ nombreCompleto });
  const docentes = await s.docentes();
  const aulas = new AulaRepository();
  const rooms = [
    { codigo: 'SS-A1', nombre: 'Aula 1 · Subsuelo', lugar: 'INFORMATICA', piso: -1, tipo: 'AULA' },
    { codigo: 'PB-A2', nombre: 'Aula 2 · Planta baja', lugar: 'INFORMATICA', piso: 0, tipo: 'AULA' },
    { codigo: 'P1-A1', nombre: 'Aula 1 · Primer piso', lugar: 'INFORMATICA', piso: 1, tipo: 'AULA' },
    { codigo: 'P1-A2', nombre: 'Aula 2 · Primer piso', lugar: 'INFORMATICA', piso: 1, tipo: 'AULA' },
    { codigo: 'P1-A3', nombre: 'Aula 3 · Primer piso', lugar: 'INFORMATICA', piso: 1, tipo: 'AULA' },
    { codigo: 'P4-LAB1', nombre: 'Laboratorio 1 · Cuarto piso', lugar: 'INFORMATICA', piso: 4, tipo: 'LABORATORIO' },
    { codigo: '04-02-09', nombre: 'Aula 04-02-09', lugar: 'ANTIGUO', piso: null, tipo: 'AULA' },
    { codigo: 'PAB-G', nombre: 'Pabellón G', lugar: 'PABELLONES', piso: null, tipo: 'AULA' },
  ] as const;
  for (const r of rooms) if (!await aulas.findById(r.codigo)) await aulas.create({ ...r, capacidad: 0, ubicacion: 'Muestra del PDF · II/2026', estado: 'disponible' });
  for (let i = 0; i < materias.length; i++) {
    const teacher = docentes.find(d => d.nombreCompleto === names[i])!;
    if (!(await s.asignaciones()).some(a => a.codigoMateria === materias[i].codigo && a.idPeriodo === period!.idPeriodo && a.grupo === 'A')) await s.asignar({ idDocente: teacher.idDocente, codigoMateria: materias[i].codigo, idPeriodo: period.idPeriodo, grupo: 'A' });
  }
  const assignments = await s.asignaciones(), horarios = new HorarioRepository();
  const sample = [
    ['INF-111', 'P4-LAB1', 'MARTES', '10:00', '12:00'], ['INF-111', 'P4-LAB1', 'JUEVES', '10:00', '12:00'],
    ['INF-112', 'PB-A2', 'LUNES', '08:00', '10:00'], ['INF-112', 'P1-A2', 'MARTES', '08:00', '10:00'], ['INF-112', 'P1-A2', 'JUEVES', '08:00', '10:00'],
    ['INF-124', 'PAB-G', 'MARTES', '08:00', '10:00'], ['INF-124', 'PAB-G', 'JUEVES', '08:00', '10:00'],
    ['INF-125', '04-02-09', 'MARTES', '10:00', '12:00'], ['INF-125', '04-02-09', 'JUEVES', '10:00', '12:00'],
    ['INF-381', 'P1-A3', 'LUNES', '10:00', '12:00'], ['INF-381', 'P1-A3', 'MIERCOLES', '10:00', '12:00'],
  ] as const;
  for (const [codigo, aula, dia, horaInicio, horaFin] of sample) {
    const a = assignments.find(a => a.codigoMateria === codigo && a.grupo === 'A' && a.idPeriodo === period!.idPeriodo)!;
    if (!(await horarios.findAll()).some(h => h.idAsignacion === a.idAsignacion && h.aula === aula && h.dia === dia && h.horaInicio === horaInicio)) await horarios.create({ idAsignacion: a.idAsignacion, aula, dia, horaInicio, horaFin });
  }
  console.log('Muestra académica lista: 5 docentes, 5 materias (6 siglas), 8 aulas y 11 clases.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
