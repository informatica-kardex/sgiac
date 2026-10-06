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
test('combina laboratorio, capacidad, lugar y equipamiento con cantidad registrada',()=>{
  const filters={...EMPTY_ROOM_SEARCH,students:'30',type:'LABORATORIO',place:'LASIN',equipment:'proyector',query:'programacion'};
  assert.deepEqual(codes(searchRooms(rooms,filters).adequate),['LAB30']);
  assert.equal(searchRooms(rooms,{...filters,students:'31'}).adequate.length,0);
  assert.equal(searchRooms(rooms,{...filters,place:'INFORMATICA'}).adequate.length,0);
  assert.equal(searchRooms(rooms,{...filters,equipment:'impresora'}).adequate.length,0,'Cantidad cero no se ofrece como equipamiento existente');
  assert.equal(searchRooms(rooms,{...filters,query:'LAB30 computadora'}).adequate.length,1);
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
