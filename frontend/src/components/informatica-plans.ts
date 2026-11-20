import type { Aula } from '../api/types';

export type MapRoom = Pick<Aula, 'codigo' | 'nombre' | 'lugar' | 'piso'> & Partial<Pick<Aula, 'estado'>>;
export interface PlanArea { points: string; x: number; y: number; compact?: boolean; stairs?: [number, number, number, number] }
export interface PlanSpace { letter: string; name: string; color: string; code?: string; roomName?: string; dark?: boolean; areas: PlanArea[] }
export interface FloorPlan { floor: number; title: string; width: number; height: number; spaces: PlanSpace[]; corridor: string; passage: [number, number]; entry: [number, number]; atrium?: [number, number, number, number] }
const red = '#ca414b', orange = '#e6a05a', yellow = '#e4c453', green = '#32896c', cyan = '#43a8c5', blue = '#344d82', pink = '#a1326a', brown = '#875446', gray = '#c5c9ba', sand = '#e6d991';
const rect = (x: number, y: number, w: number, h: number, compact = false): PlanArea => ({ points: `${x},${y} ${x+w},${y} ${x+w},${y+h} ${x},${y+h}`, x: x+w/2, y: y+h/2, compact });
const shape = (points: string, x: number, y: number): PlanArea => ({ points, x, y });
const space = (letter: string, name: string, color: string, area: PlanArea, code?: string): PlanSpace => ({ letter, name, color, areas: [area], code, dark: [blue, pink, red, green, brown].includes(color) });
const stairs = (x: number, y: number, w: number, h: number): PlanArea => ({ ...rect(x, y, w, h, true), y: y+h-10, stairs: [x,y,w,h] });
const lifts = (letter: string): PlanSpace => ({ letter, name: 'Ascensor', color: gray, areas: [rect(412,230,28,24,true),rect(412,254,28,24,true),rect(360,310,24,40,true)] });
const steps = (letter: string) => space(letter, 'Gradas', sand, stairs(384,310,36,60));
const shaft = () => space('A', 'Shaft', red, rect(390,212,50,18,true));
const service = (name: string) => space('B', name, orange, rect(390,140,50,72));
const bathrooms = (letter = 'C') => space(letter, 'Baños', cyan, shape('360,20 440,20 440,90 420,90 420,100 385,100 385,90 360,90',400,57));
const triangle = (letter: string, name: string) => space(letter,name,brown,shape('250,230 360,230 360,310',326,255));
const extension = (letter: string, name: string) => space(letter,name,green,rect(420,230,120,120));
const common = { width: 560, height: 390, corridor: '140,110 360,110 360,90 385,90 385,100 420,100 420,90 440,90 440,140 390,140 390,230 412,230 412,278 420,278 420,310 360,310 360,140 140,140', passage: [247,129] as [number,number], entry: [385,263] as [number,number], atrium: [280,140,80,90] as [number,number,number,number] };

// Front-facing plans transcribed from the building signs. Only the intentional
// triangular rooms remain diagonal; camera perspective is not part of the plan.
export const INFORMATICA_PLANS: FloorPlan[] = [
  { floor: -1, title: 'Subsuelo', width: 440, height: 360,
    corridor: '160,60 260,60 260,210 320,210 400,210 400,280 320,280 320,210 115,210 115,160 160,160', passage: [210,137], entry: [138,186],
    spaces: [
      space('A','Shaft',red,{...shape('320,210 345,210 320,235',326,219),compact:true}),
      space('B','SS Aula 1',orange,rect(260,110,140,100),'SS-A1'),
      space('C','SS Aula 2',yellow,rect(260,20,140,90),'SS-A2'),
      space('D','Oficina 1',green,rect(160,20,60,40)),
      space('E','SS Aula 3',cyan,rect(20,20,140,80),'SS-A3'),
      space('F','SS Aula 4',blue,shape('20,100 160,100 160,160 115,160 115,210 20,210',75,149),'SS-A4'),
      space('G','Museo Computacional',brown,shape('155,210 320,210 320,310',267,239)),
      { letter:'H',name:'Ascensor',color:gray,areas:[rect(370,210,30,22,true),rect(370,232,30,22,true),rect(320,280,24,40,true)] },
      { letter:'I',name:'Gradas',color:sand,areas:[stairs(220,20,40,40),stairs(115,210,40,50),stairs(344,280,40,60)] },
    ] },
  { floor: 0, title: 'Planta baja', width: 460, height: 360,
    corridor: '110,85 140,85 140,160 250,160 250,140 350,140 350,210 392,210 392,254 420,254 420,280 365,280 285,210 100,210 100,160 110,160', passage: [205,190], entry: [377,239],
    spaces: [
      space('A','Shaft',red,rect(350,195,70,15,true)),
      space('B','Oficina de Seguridad',orange,rect(350,140,70,55)),
      space('C','Biblioteca',yellow,shape('140,20 420,20 420,140 250,140 250,160 140,160',280,83)),
      space('D','PB Aula 1',green,rect(20,20,120,65),'PB-A1'),
      space('E','Sala de Docentes',cyan,rect(20,85,90,40)),
      space('F','PB Aula 2',blue,shape('20,125 110,125 110,160 100,160 100,210 20,210',61,163),'PB-A2'),
      { letter:'G',name:'Ascensor',color:gray,areas:[rect(392,210,28,22,true),rect(392,232,28,22,true),rect(365,280,22,40,true)] },
      space('H','Gradas',sand,stairs(387,280,33,60)),
    ] },
  { ...common, floor: 1, title: 'Piso 1', width: 460,
    spaces: [shaft(),service('Of. Centro de Estudiantes 2'),bathrooms(),
      space('D','P1 Aula 1',yellow,rect(160,20,200,90),'P1-A1'),
      space('E','P1 Aula 2',green,rect(20,20,140,90),'P1-A2'),
      space('F','P1 Aula 3',blue,shape('20,110 140,110 140,150 160,150 160,230 20,230',80,177),'P1-A3'),
      space('G','Oficina',pink,rect(160,140,120,90)),triangle('H','Of. Centro de Estudiantes 1'),lifts('I'),steps('J')],
  },
  { ...common, floor: 2, title: 'Piso 2', width: 460,
    corridor: '140,110 390,110 390,230 412,230 412,278 440,278 440,310 360,310 360,140 140,140',
    spaces: [shaft(),space('B','Sala Data Center',orange,rect(390,110,50,102)),
      space('C','Instituto de Investigación de Informática',yellow,shape('280,20 440,20 440,110 340,110 340,65 280,65',388,66)),
      space('D','Kardex Académico',green,shape('140,20 280,20 280,65 340,65 340,110 140,110',213,64)),
      space('E','Sala Docentes · Cubículos-Investigadores',blue,rect(20,20,120,210)),
      space('F','Sala Audiovisual',pink,rect(140,140,140,90)),triangle('G','Sala de Proyectos Investigación'),lifts('H'),steps('I')],
  },
  { ...common, floor: 3, title: 'Piso 3',
    spaces: [shaft(),service('Of. 2 Sala de Mantenimiento'),bathrooms(),
      space('D','P3 Laboratorio 1',yellow,rect(270,20,90,90),'P3-LAB1'),
      space('E','P3 Laboratorio 2',orange,rect(140,20,130,90),'P3-LAB2'),
      space('F','P3 Laboratorio 3',red,rect(20,20,120,210),'P3-LAB3'),
      space('G','P3 Laboratorio 4',pink,rect(140,140,140,90),'P3-LAB4'),
      triangle('H','Sala de Lectura'),extension('I','Oficina ITIC'),lifts('J'),steps('K')],
  },
  { ...common, floor: 4, title: 'Piso 4',
    corridor: '140,110 360,110 360,55 400,55 400,110 440,110 440,140 390,140 390,230 412,230 412,278 420,278 420,310 360,310 360,140 140,140',
    spaces: [shaft(),service('Oficina 2'),space('C','Depósito',green,rect(400,82,40,28)),space('D','Cocina',blue,rect(400,55,40,27)),
      space('E','Baños',cyan,shape('360,20 440,20 440,55 400,55 360,55',402,37)),
      space('F','P4 Aula 1',green,rect(260,20,100,90),'P4-A1'),
      space('G','P4 Laboratorio 1',yellow,rect(140,20,120,90),'P4-LAB1'),
      space('H','P4 Aula 2',orange,rect(20,20,120,120),'P4-A2'),
      space('I','P4 Aula 3',red,rect(20,140,120,90),'P4-A3'),
      space('J','P4 Aula 4',pink,rect(140,140,140,90),'P4-A4'),
      triangle('K','Sala de Docentes'),extension('L','Oficina 1'),lifts('M'),steps('N')],
  },
  { ...common, floor: 5, title: 'Piso 5',
    spaces: [shaft(),service('Depósito 1'),bathrooms(),
      space('D','P5 Aula 1 · Sala de Concejo',red,rect(280,20,80,90),'P5-A1'),
      space('E','P5 Aula 2',orange,rect(210,20,70,90),'P5-A2'),
      space('F','P5 Aula 3',yellow,rect(140,20,70,90),'P5-A3'),
      space('G','P5 Laboratorio 1',green,rect(20,20,120,120),'P5-LAB1'),
      space('H','P5 Aula 4',blue,rect(20,140,140,90),'P5-A4'),
      space('I','P5 Aula 5',pink,rect(160,140,120,90),'P5-A5'),
      triangle('J','Sala de Docentes'),extension('K','Dirección de Carrera'),lifts('L'),steps('M')],
  },
  { ...common, floor: 6, title: 'Piso 6', passage: [341,129],
    corridor: '280,110 360,110 360,90 385,90 385,100 420,100 420,90 440,90 440,110 390,110 390,230 412,230 412,278 420,278 420,310 360,310 360,140 280,140',
    spaces: [shaft(),service('Sala de Control'),space('C','Cocina',yellow,rect(390,110,50,30,true)),bathrooms('D'),
      space('E','Depósito 1',blue,rect(335,20,25,90)),space('F','Depósito 2',pink,rect(305,20,30,90)),
      space('G','Sala de Control',orange,rect(280,20,25,90)),
      { ...space('H','Auditorio',yellow,rect(20,20,260,210)),roomName:'Auditorio' },
      triangle('I','Asociación de Docentes'),extension('J','Sala Comedor'),lifts('K'),steps('L')],
  },
];

export function roomForSpace<T extends MapRoom>(aulas: T[], plan: FloorPlan, space: PlanSpace): T | undefined {
  const matches = aulas.filter(a => a.lugar === 'INFORMATICA' && a.piso === plan.floor &&
    (space.code ? a.codigo === space.code : space.roomName ? a.nombre.trim().toLocaleLowerCase('es') === space.roomName.toLocaleLowerCase('es') : false));
  return matches.length === 1 ? matches[0] : undefined;
}
export function hasRoomLocation(aula: MapRoom) {
  return INFORMATICA_PLANS.some(plan => plan.spaces.some(space => Boolean(roomForSpace([aula],plan,space))));
}
