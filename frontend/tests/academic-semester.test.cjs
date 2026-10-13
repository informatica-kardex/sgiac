const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(name) {
  const filename = path.resolve(__dirname, '../src/admin/schedule', name + '.ts');
  const compiled = new Module(filename, module);
  compiled.paths = module.paths;
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
  return compiled.exports;
}
const { filterSubjects, subjectPosition } = load('subjects');
const { semesterSessions, semesterLayout, localDate, clockLabel, sessionColor, semesterColors, sessionKey, assistantColor, preuniversityColor } = load('semester');
const { datosPlan, compararPlanes, menciones } = require('../../backend/dist/modules/academico/planes-estudio');
const catalog = require('../../backend/prisma/data/catalogo-pdf.json').materias;
const subjects = catalog.map((m,i) => ({...m, codigo:String(i), estado:'ACTIVO', ...datosPlan(m.nombre)}));
const subject = name => subjects.find(m=>m.nombre === name);

test('las siete menciones cubren el catálogo y el orden comienza por Programación I', () => {
  assert.equal(menciones.length, 7);
  assert.equal(subjects.length, 114);
  assert.ok(subjects.every(m=>m.planes.length));
  const general=filterSubjects([...subjects].reverse(), '', '');
  assert.equal(general.length,114);
  assert.deepEqual(general.slice(0,5).map(m=>m.siglas[0]),['INF-111','INF-112','INF-113','INF-114','INF-115']);
  assert.deepEqual(general.map(m=>m.codigo), [...subjects].sort(compararPlanes).map(m=>m.codigo));
  for(const mention of menciones) {
    const result=filterSubjects(subjects, mention.id, '');
    assert.ok(result.length>30);
    assert.equal(result[0].siglas[0], 'INF-111');
    assert.ok(result.every(m=>m.planes.some(p=>p.mencion===mention.id)));
    assert.equal(new Set(result.map(m=>m.codigo)).size,result.length);
  }
});
test('promedia semestres por mención y deja electivas y materias nuevas al final', () => {
  const methods=subject('METODOS NUMERICOS I');
  assert.equal(subjectPosition(methods).semestre,5.25);
  assert.equal(subjectPosition(methods,'SOFTWARE').semestre,7);
  assert.equal(subjectPosition(methods,'DATOS').semestre,4);
  const unknown={codigo:'NEW',nombre:'AAAA',siglas:[],planes:[]};
  const list=filterSubjects([unknown,...subjects],'','');
  assert.equal(list.at(-1).codigo,'NEW');
  assert.deepEqual(datosPlan('Materia ajena al plan').planes,[]);
});
test('incluye materias comunes, distingue INF-244 y combina búsqueda y mención', () => {
  assert.ok(!filterSubjects(subjects,'DATOS','fisica').length);
  assert.equal(filterSubjects(subjects,'COMPUTACION','matematica discreta').length,1);
  assert.equal(filterSubjects(subjects,'SOFTWARE','INF-244').length,2);
  assert.deepEqual(filterSubjects(subjects,'DATOS','INF-244').map(m=>m.nombre),['BASE DE DATOS II']);
  assert.deepEqual(filterSubjects(subjects,'INDUSTRIAL','INF-244').map(m=>m.nombre),['INTRODUCCIÓN A LA ROBÓTICA']);
  assert.equal(filterSubjects(subjects,'SOFTWARE','programacion i')[0].siglas[0],'INF-111');
  assert.equal(filterSubjects(subjects,'SOFTWARE','CRIPT')[0],undefined);
});
const period={idPeriodo:'1',fechaInicio:'2026-07-01',fechaFin:'2026-12-20'};
const lesson = (changes={})=>({idHorario:1,aula:'A1',idPeriodo:'1',dia:'LUNES',fecha:null,horaInicio:'08:00',horaFin:'10:00',codigoMateria:'INF-111',idDocente:'1',grupo:'A',...changes});
test('horario fijo conserva clases y todas las reservas futuras, oculta vencidas y otros periodos',()=>{
  const rows=[lesson(),lesson({idHorario:2,fecha:'2026-10-02'}),lesson({idHorario:3,fecha:'2026-10-12'}),lesson({idHorario:4,fecha:'2026-10-01'}),lesson({idHorario:5,idPeriodo:'2'}),lesson({idHorario:6,aula:'A2'}),lesson({idHorario:7,fecha:'2026-12-21'})];
  assert.deepEqual(semesterSessions(rows,'A1',period,'2026-10-02').map(h=>h.idHorario),[1,2,3]);
  assert.deepEqual(semesterSessions(rows,'A1',period,'2026-10-03').map(h=>h.idHorario),[1,3]);
  assert.equal(localDate(new Date('2026-10-03T03:59:59Z')),'2026-10-02');
  assert.equal(localDate(new Date('2026-10-03T04:00:00Z')),'2026-10-03');
});
test('agrupa reservas superpuestas de fechas distintas sin perderlas, respeta franjas contiguas',()=>{
  const rows=[lesson({idHorario:1,fecha:'2026-10-05'}),lesson({idHorario:2,fecha:'2026-10-12',horaInicio:'09:30',horaFin:'11:00'}),lesson({idHorario:3,horaInicio:'11:00',horaFin:'12:00'})];
  const layout=semesterLayout(rows);
  assert.equal(layout.columns.length,5);
  assert.deepEqual(layout.columns[0].blocks.map(b=>b.sessions.map(h=>h.idHorario)),[[1,2],[3]]);
  assert.ok(layout.boundaries.includes(660));
  assert.equal(semesterLayout([lesson({dia:'SABADO',horaInicio:'07:00'})]).columns.length,6);
  assert.equal(semesterLayout([lesson({horaInicio:'07:00'})]).boundaries[0],420);
  assert.equal(semesterLayout([],true).columns.length,6);
  assert.equal(clockLabel(570),'09:30');
  assert.equal(sessionColor(lesson()),sessionColor(lesson({idHorario:3,dia:'MIERCOLES'})));
});

test('colores vivos sin repeticiones exactas entre asignaciones y consistentes entre aulas y días',()=>{
  const rows=Array.from({length:200},(_,i)=>lesson({codigoMateria:`INF-${i}`,idDocente:String(i)}));
  const colors=semesterColors(rows);
  assert.equal(new Set(colors.values()).size,200);
  assert.deepEqual(colors,semesterColors([...rows].reverse()));
  const repeats=rows.map(h=>({...h,aula:'OTRA',dia:'VIERNES',idHorario:h.idHorario+300}));
  assert.deepEqual(colors,semesterColors([...rows,...repeats]));
  assert.equal(colors.get(sessionKey(rows[0])),semesterColors(repeats).get(sessionKey(rows[0])));
  const rgb=color=>{
    if(color.startsWith('#'))return [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255);
    const [h,s,l]=color.match(/[\d.]+/g).map(Number),sat=s/100,light=l/100;
    const f=n=>{const k=(n+h/30)%12,a=sat*Math.min(light,1-light);return light-a*Math.max(-1,Math.min(k-3,9-k,1));};return [f(0),f(8),f(4)];
  };
  const lum=color=>rgb(color).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
  for(const color of colors.values())assert.ok((lum(color)+.05)/(lum('#24333a')+.05)>=4.5,`Texto legible sobre ${color}`);
});

test('auxiliares siempre plateados, C.P.U. tiene un color fijo y las demás asignaciones no lo repiten',()=>{
  const teacher=lesson(), assistant=lesson({idAuxiliar:'9'}), pending=lesson({codigoMateria:'OTRA',esAuxiliar:true,idAuxiliar:null});
  const cpu=lesson({codigoMateria:'CPU',grupo:'SIN PARALELO'});
  const rows=[teacher,assistant,pending,cpu,lesson({codigoMateria:'CPU',aula:'LASIN-2',dia:'MIERCOLES'}),lesson({codigoMateria:'OTRA',idDocente:'2'})];
  const colors=semesterColors(rows);
  assert.equal(colors.get(sessionKey(assistant)),assistantColor);
  assert.equal(colors.get(sessionKey(pending)),assistantColor);
  assert.equal(sessionColor(pending),assistantColor);
  assert.equal(colors.get(sessionKey(cpu)),preuniversityColor);
  assert.equal(sessionColor(cpu),preuniversityColor);
  for(const h of rows.filter(h=>!h.esAuxiliar&&!h.idAuxiliar&&h.codigoMateria!=='CPU')) {
    assert.notEqual(colors.get(sessionKey(h)),assistantColor);
    assert.notEqual(colors.get(sessionKey(h)),preuniversityColor);
  }
  assert.notEqual(colors.get(sessionKey(teacher)),colors.get(sessionKey(rows.at(-1))));
});
