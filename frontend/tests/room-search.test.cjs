const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const filename=path.resolve(__dirname,'../src/admin/schedule/room-search.ts');
const compiled=new Module(filename,module);compiled.paths=module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {searchRooms,EMPTY_ROOM_SEARCH}=compiled.exports;
const room=(codigo,capacidad,extra={})=>({idAula:codigo,codigo,nombre:codigo,capacidad,tipo:'AULA',lugar:'INFORMATICA',piso:1,estado:'disponible',ubicacion:'',equipamiento:[],...extra});
const rooms=[room('A40',40),room('A28',28),room('A0',0),room('A30',30),room('A32',32),room('A20',20),room('CERRADA',30,{estado:'mantenimiento'}),
  room('LAB30',30,{tipo:'LABORATORIO',lugar:'LASIN',nombre:'Laboratorio de programación',equipamiento:[{nombre:'Proyector',cantidad:1},{nombre:'Computadoras',cantidad:25},{nombre:'Impresora',cantidad:0}]})];
const codes=rows=>rows.map(r=>r.codigo);

test('para 30 personas prioriza capacidades suficientes cercanas; separa menores y desconocidas',()=>{
  const result=searchRooms(rooms,{...EMPTY_ROOM_SEARCH,students:'30'});
  assert.deepEqual(codes(result.adequate),['A30','LAB30','A32','A40']);
  assert.deepEqual(codes(result.smaller),['A28','A20']);
  assert.deepEqual(codes(result.unknown),['A0']);
  assert.ok(!result.adequate.some(r=>r.codigo==='CERRADA'));
  assert.deepEqual(codes(rooms),['A40','A28','A0','A30','A32','A20','CERRADA','LAB30'],'La búsqueda no cambia el catálogo original');
});
test('combina laboratorio, capacidad, lugar y nombre, sin buscar por equipamiento',()=>{
  const filters={...EMPTY_ROOM_SEARCH,students:'30',type:'LABORATORIO',place:'LASIN',query:'programacion'};
  assert.deepEqual(codes(searchRooms(rooms,filters).adequate),['LAB30']);
  assert.equal(searchRooms(rooms,{...filters,students:'31'}).adequate.length,0);
  assert.equal(searchRooms(rooms,{...filters,place:'INFORMATICA'}).adequate.length,0);
  assert.equal(searchRooms(rooms,{...filters,query:'proyector'}).adequate.length,0);
  assert.equal(searchRooms(rooms,{...filters,query:'LAB30 programacion'}).adequate.length,1);
});

const period={idPeriodo:'1',gestion:2026,periodo:'II',fechaInicio:'2026-07-01',fechaFin:'2026-12-31',estado:'ACTIVO'};
const context={horarios:[],periodos:[period],periodId:'1',today:'2026-10-06'};
const slot={...EMPTY_ROOM_SEARCH,students:'30',day:'LUNES',start:'09:00',end:'11:00'};
const session=(aula,extra={})=>({aula,idPeriodo:'1',dia:'LUNES',horaInicio:'09:00',horaFin:'11:00',fecha:null,...extra});

test('excluye cruces parciales y totales; admite horas adyacentes y otros días',()=>{
  const aulaList=['PARCIAL','COMPLETO','ANTES','DESPUES','OTRO-DIA'].map(c=>room(c,30));
  const horarios=[session('PARCIAL',{horaInicio:'08:00',horaFin:'10:00'}),session('COMPLETO',{horaInicio:'08:00',horaFin:'12:00'}),
    session('ANTES',{horaInicio:'07:00',horaFin:'09:00'}),session('DESPUES',{horaInicio:'11:00',horaFin:'12:00'}),session('OTRO-DIA',{dia:'MARTES'})];
  const r=searchRooms(aulaList,slot,{...context,horarios});
  assert.deepEqual(codes(r.adequate),['ANTES','DESPUES','OTRO-DIA']);assert.equal(r.occupiedCount,2);
  assert.equal(r.checkingAvailability,true);assert.equal(r.availabilityError,'');
});
test('reservas: distingue fechas, ignora vencidas y sin fecha considera todas las vigentes',()=>{
  const aulaList=['VENCIDA','PROXIMA','LIBRE'].map(c=>room(c,30));
  const horarios=[session('VENCIDA',{fecha:'2026-10-05'}),session('PROXIMA',{fecha:'2026-10-12'})];
  const data={...context,horarios};
  assert.deepEqual(codes(searchRooms(aulaList,slot,data).adequate),['LIBRE','VENCIDA']);
  assert.deepEqual(codes(searchRooms(aulaList,{...slot,date:'2026-10-12'},data).adequate),['LIBRE','VENCIDA']);
  assert.equal(searchRooms(aulaList,{...slot,date:'2026-10-19'},data).adequate.length,3);
});
test('considera periodos activos superpuestos y excluye periodos cerrados o sin coincidencia de fechas',()=>{
  const periodos=[period,{...period,idPeriodo:'2',periodo:'ANUAL',fechaInicio:'2026-01-01'},
    {...period,idPeriodo:'3',estado:'CERRADO'},{...period,idPeriodo:'4',fechaInicio:'2027-01-01',fechaFin:'2027-06-30'},
    {...period,idPeriodo:'5',fechaInicio:'2026-12-31',fechaFin:'2026-12-31'}];
  const aulaList=['ANUAL','CERRADO','FUTURO','JUEVES'].map(c=>room(c,30));
  const horarios=aulaList.map((a,i)=>session(a.codigo,{idPeriodo:String(i+2)}));
  assert.deepEqual(codes(searchRooms(aulaList,slot,{...context,periodos,horarios}).adequate),['CERRADO','FUTURO','JUEVES']);
  assert.ok(searchRooms(aulaList,slot,{...context,periodId:'3',periodos,horarios}).availabilityError);
});
test('datos incompletos, horas incorrectas y fechas inválidas nunca se presentan como disponibles',()=>{
  for(const patch of [{day:''},{start:''},{end:''},{start:'12:00'},{end:'09:00'},{start:'06:59'},{end:'22:01'},{end:'11:90'},
    {date:'2026-10-13'},{date:'2026-10-05'},{date:'2027-01-04'},{date:'2026-02-30'}]) {
    const r=searchRooms(rooms,{...slot,...patch},context);assert.ok(r.availabilityError,JSON.stringify(patch));
    assert.deepEqual(r.adequate,[]);assert.deepEqual(r.combinations,[]);assert.deepEqual(r.unknown,[]);
  }
  assert.ok(searchRooms(rooms,slot).availabilityError,'Faltan los datos de horarios/periodos');
  assert.ok(searchRooms(rooms,slot,{...context,periodId:'ausente'}).availabilityError);
  assert.equal(searchRooms(rooms,{...slot,enabledOnly:false},context).adequate.some(a=>a.codigo==='CERRADA'),false,'Mantenimiento no se ofrece como libre');
});
test('recomienda dos o más aulas y prioriza mismo piso antes que pisos contiguos',()=>{
  const aulaList=[room('P1-A',20),room('P1-B',20),room('P1-C',20),room('P3-A',35,{piso:3}),room('P4-A',25,{piso:4})];
  const r=searchRooms(aulaList,{...EMPTY_ROOM_SEARCH,students:'60'});
  assert.equal(r.adequate.length,0);assert.equal(r.combinations.length,2);
  assert.deepEqual(codes(r.combinations[0].rooms),['P1-A','P1-B','P1-C']);
  assert.deepEqual(codes(r.combinations[1].rooms),['P3-A','P4-A']);
  assert.ok(r.combinations.every(c=>c.capacity===60));
  assert.deepEqual(searchRooms([...aulaList,room('SUFICIENTE',60)],{...EMPTY_ROOM_SEARCH,students:'60'}).combinations,[]);
});
test('nunca mezcla edificios, pisos separados, piso desconocido ni capacidades sin confirmar',()=>{
  const r=searchRooms([room('SS',40,{piso:-1}),room('P4',40,{piso:4}),room('OTRO',40,{piso:4,lugar:'LASIN'}),
    room('SIN-PISO',40,{piso:null}),room('SIN-LUGAR',40,{lugar:null,piso:4}),room('SIN-CAPACIDAD',0,{piso:4}),
    room('CERRADA',100,{piso:4,estado:'mantenimiento'})],{...EMPTY_ROOM_SEARCH,students:'70',enabledOnly:false});
  assert.deepEqual(r.combinations,[]);
  const pb=searchRooms([room('SS',40,{piso:-1}),room('PB',40,{piso:0})],{...EMPTY_ROOM_SEARCH,students:'70'});
  assert.equal(pb.combinations.length,1);assert.equal(pb.combinations[0].maxFloor-pb.combinations[0].minFloor,1);
  assert.deepEqual(searchRooms([room('PAB-E',40,{lugar:'PABELLONES',piso:0}),room('PAB-G',40,{lugar:'PABELLONES',piso:0})],{...EMPTY_ROOM_SEARCH,students:'70'}).combinations,[],'Pabellones distintos no son el mismo edificio');
});
test('todas las aulas de una combinación deben estar libres durante el intervalo completo',()=>{
  const aulaList=[room('A',40),room('B',30),room('C',30)];
  const filter={...slot,students:'65'};
  const r=searchRooms(aulaList,filter,{...context,horarios:[session('B',{horaInicio:'10:30',horaFin:'12:00'})]});
  assert.deepEqual(codes(r.combinations[0].rooms),['A','C']);
  assert.equal(searchRooms(aulaList,filter,{...context,horarios:[session('A')]}).combinations.length,0);
});
test('la combinación minimiza cantidad de aulas y plazas sobrantes; coincide con enumeración exhaustiva',()=>{
  for(let seed=1;seed<=25;seed++) {
    const aulaList=Array.from({length:8},(_,i)=>room(`A${i}`,15+(seed*17+i*23)%60));
    const requested=100+seed*3, feasible=[];
    for(let mask=1;mask<256;mask++) {
      const subset=aulaList.filter((_,i)=>mask&(1<<i)),capacity=subset.reduce((sum,a)=>sum+a.capacidad,0);
      if(capacity>=requested)feasible.push({count:subset.length,capacity});
    }
    feasible.sort((a,b)=>a.count-b.count||a.capacity-b.capacity);
    const best=searchRooms(aulaList,{...EMPTY_ROOM_SEARCH,students:String(requested)}).combinations[0];
    assert.equal(best.rooms.length,feasible[0].count);assert.equal(best.capacity,feasible[0].capacity);
    assert.equal(new Set(codes(best.rooms)).size,best.rooms.length,'No repite aulas');
  }
});
test('capacidades sin confirmar no se convierten en suficientes y el catálogo vacío no falla',()=>{
  assert.equal(searchRooms([room('SIN',0)],{...EMPTY_ROOM_SEARCH,students:'1'}).adequate.length,0);
  assert.deepEqual(codes(searchRooms(rooms,{...EMPTY_ROOM_SEARCH,enabledOnly:false,query:'CERRADA'}).adequate),['CERRADA']);
  const all=searchRooms(rooms,EMPTY_ROOM_SEARCH);assert.equal(all.smaller.length,0);assert.equal(all.requested,null);assert.equal(all.unknown.length,1);
  assert.deepEqual(searchRooms([],EMPTY_ROOM_SEARCH).adequate,[]);
});
test('rechaza cantidades inválidas en vez de recomendar aulas para un valor erróneo',()=>{
  for(const students of ['0','-1','30.5','2001','treinta','Infinity']) {
    const result=searchRooms(rooms,{...EMPTY_ROOM_SEARCH,students});
    assert.equal(result.invalidCapacity,true);assert.deepEqual(result.adequate,[]);assert.deepEqual(result.smaller,[]);assert.deepEqual(result.unknown,[]);
  }
  assert.equal(searchRooms(rooms,{...EMPTY_ROOM_SEARCH,students:' 30 '}).requested,30);
});
