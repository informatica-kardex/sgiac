import type { DiaSemana } from '../../api/types';

export interface PdfText { text: string; x: number; y: number; width: number }
export interface PdfPage { items: PdfText[] }
export interface PdfSession {
  dia: DiaSemana; horaInicio: string; horaFin: string; aula: string; aulas: string[];
  fuente: string; pagina: number; excluida: string;
}
export interface PdfGroup {
  key: string; materia: string; siglas: string[]; docente: string; paralelo: string;
  pagina: number; sesiones: PdfSession[]; errores: string[];
}
export interface PdfSchedule { grupos: PdfGroup[]; avisos: string[]; periodo: { gestion: number; periodo: string } | null }
export const normalPdf = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const identity = (s: string) => normalPdf(s).replace(/DEEP LERNING/g, 'DEEP LEARNING').replace(/[^A-Z0-9]/g, '');
const day = '(?:LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO)';
const startsDay = new RegExp(`^(?:(?:AUX(?:ILIAR)?|DOCENTE)\\.?\\s*[:.-]?\\s*)?${day}\\b`);
const schedule = new RegExp(`^((?:${day})(?:\\s*(?:Y|,|/)\\s*${day})*)\\s+DE\\s+(\\d{1,2}:[0-5]\\d)(?::00)?\\s+A\\s+(\\d{1,2}:[0-5]\\d)(?::00)?\\s*[-–—]\\s*(.+)$`);
const subject = /^([A-Z]{2,10}\s*-\s*\d[A-Z0-9.-]*)\s+[-–—]\s+(.+)$/;
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function normalizePdfRoom(s: string) {
  return normalPdf(s).replace(/\s*\(EDIF\.?\s*ANTIGUO\)\s*/g, '').replace(/^AULA\s+/, '').replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');
}
function parseSession(text: string, pagina: number): PdfSession[] | null {
  const raw = normalPdf(text);
  const auxiliar = /\bAUX(?:ILIAR(?:IA)?)?\b/.test(raw);
  const clean = raw.replace(/\(?\b(?:AUX(?:ILIAR(?:IA)?)?|DOCENTE)\.?\)?\s*[:.-]?/g, '').trim();
  const match = schedule.exec(clean);
  if (!match) return null;
  const horaInicio = match[2].padStart(5, '0'), horaFin = match[3].padStart(5, '0');
  const aulas = [...new Set(match[4].split(/\s+Y\s+|\s*[,/]\s*/).map(normalizePdfRoom))];
  const excluida = auxiliar ? 'Auxiliar indicado en el PDF' : minutes(horaFin) - minutes(horaInicio) !== 120
    ? 'No cumple la duración de dos horas' : horaInicio < '07:00' || horaFin > '22:00' ? 'Fuera del horario de 07:00 a 22:00' : '';
  return (match[1].match(new RegExp(day, 'g')) ?? []).map(dia => ({ dia: dia as DiaSemana, horaInicio, horaFin,
    aula: aulas.length === 1 ? aulas[0] : '', aulas, fuente: text, pagina, excluida }));
}
function lines(items: PdfText[]) {
  const rows: PdfText[][] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.find(r => Math.abs(r[0].y - item.y) < 2);
    if (row) row.push(item); else rows.push([item]);
  }
  return rows.map(r => r.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim());
}

// Positions matter: this report repeats some schedules outside their column.
// Reading its text stream in order would attach those copies to other teachers.
export function parseSchedulePages(pages: PdfPage[]): PdfSchedule {
  const grupos: PdfGroup[] = [], avisos: string[] = [];
  const sourceLines = new Map<PdfGroup, { text: string; pagina: number }[]>();
  let currentSubject: { sigla: string; materia: string } | null = null;
  let currentGroup: PdfGroup | null = null;
  const periods = new Map<string, { gestion: number; periodo: string }>();
  for (const [pageIndex, page] of pages.entries()) {
    const pagina = pageIndex + 1;
    const items = page.items.filter(i => i.text.trim()).map(i => ({ ...i, text: i.text.trim() }));
    for (const i of items) {
      const m = normalPdf(i.text).match(/HORARIOS?.*?\b(PRIMER[OA]?|SEGUND[OA]|I|II)\s+(20\d{2})\b/);
      if (m) { const p = { gestion: Number(m[2]), periodo: /^(SEGUND|II$)/.test(m[1]) ? 'II' : 'I' }; periods.set(`${p.periodo}/${p.gestion}`, p); }
    }
    const header = items.find(i => normalPdf(i.text) === 'PARALELO');
    const teacherHeader = items.find(i => normalPdf(i.text) === 'DOCENTE');
    const timeHeader = items.find(i => normalPdf(i.text) === 'HORARIO');
    if (!header || !teacherHeader || !timeHeader) {
      avisos.push(`Página ${pagina}: no se reconocieron las columnas PARALELO, DOCENTE y HORARIO.`);
      currentSubject = null; currentGroup = null; continue;
    }
    const body = items.filter(i => i.y > header.y + 3);
    const scheduleLeft = Math.min(...body.filter(i => i.x > teacherHeader.x && startsDay.test(normalPdf(i.text))).map(i => i.x));
    // A page with no classes still has to report its empty parallels.
    const timeX = Number.isFinite(scheduleLeft) ? scheduleLeft : (teacherHeader.x + timeHeader.x) / 2;
    const markers = body.filter(i => i.x >= header.x - 3 && i.x < teacherHeader.x && /^[A-Z]{1,3}$/.test(i.text));
    const teacherLeft = markers.length ? Math.max(...markers.map(i => i.x + i.width)) + 2 : header.x + header.width;
    const events = body.filter(i => (i.x < teacherLeft && subject.test(normalPdf(i.text))) || markers.includes(i) ||
      (i.x < teacherLeft && /^(?:\d+\s*-\s*|OPTATIVAS\s+)PLAN|^\d+\s*-\s*SEMESTRE/.test(normalPdf(i.text))))
      .sort((a, b) => a.y - b.y);
    function append(group: PdfGroup, from: number, to: number, readTeacher: boolean) {
      const slice = body.filter(i => i.y >= from && i.y < to);
      if (readTeacher) group.docente = lines(slice.filter(i => i.x >= teacherLeft && i.x < timeX - 3)).join(' ');
      const raw = lines(slice.filter(i => i.x >= timeX - 3));
      const entries = sourceLines.get(group) ?? [];
      sourceLines.set(group, entries);
      for (const line of raw) {
        if (startsDay.test(normalPdf(line))) entries.push({ text: line, pagina });
        else if (entries.length) entries[entries.length - 1].text += ` ${line}`;
        else group.errores.push(`Página ${pagina}: horario no reconocido: ${line}`);
      }
    }
    if (currentGroup) append(currentGroup, header.y + 3, (events[0]?.y ?? Infinity) - 2, false);
    for (let n = 0; n < events.length; n++) {
      const event = events[n], match = subject.exec(normalPdf(event.text));
      if (match) { currentSubject = { sigla: match[1].replace(/\s+/g, ''), materia: match[2] }; currentGroup = null; continue; }
      if (!markers.includes(event)) { currentSubject = null; currentGroup = null; continue; }
      if (!currentSubject) { avisos.push(`Página ${pagina}: paralelo ${event.text} sin encabezado de materia.`); continue; }
      currentGroup = { key: '', materia: currentSubject.materia, siglas: [currentSubject.sigla], docente: '', paralelo: event.text,
        pagina, sesiones: [], errores: [] };
      grupos.push(currentGroup);
      append(currentGroup, event.y - 2, (events[n + 1]?.y ?? Infinity) - 2, true);
    }
  }
  const merged = new Map<string, PdfGroup>();
  for (const g of grupos) {
    for (const { text, pagina } of sourceLines.get(g) ?? []) {
      const sessions = parseSession(text, pagina);
      if (sessions) g.sesiones.push(...sessions);
      else g.errores.push(`Página ${pagina}: no se pudo interpretar «${text}».`);
    }
    // The same class is listed under several curricula; names disambiguate INF-244.
    const key = `${identity(g.materia)}|${g.paralelo}|${identity(g.docente)}`;
    const existing = merged.get(key);
    if (existing) { existing.siglas.push(...g.siglas); existing.sesiones.push(...g.sesiones); existing.errores.push(...g.errores); }
    else merged.set(key, g);
  }
  let index = 0;
  for (const g of merged.values()) {
    g.key = `pdf-${++index}`;
    g.siglas = [...new Set(g.siglas)];
    g.sesiones = [...new Map(g.sesiones.map(s => [`${s.dia}|${s.horaInicio}|${s.horaFin}|${s.aulas.join(',')}|${s.excluida}`, s])).values()];
    if (!g.docente || /^(SIN DOCENTE|POR DESIGNAR|ACEFALIA)$/.test(normalPdf(g.docente))) g.errores.push('El PDF no identifica al docente.');
    if (!g.sesiones.length) g.errores.push('El PDF no contiene sesiones para este paralelo.');
  }
  if (periods.size > 1) avisos.push('El PDF menciona varios periodos académicos. Revisa el periodo de destino.');
  return { grupos: [...merged.values()], avisos, periodo: periods.size === 1 ? [...periods.values()][0] : null };
}

export function automaticSessions(g: PdfGroup): number[] {
  const valid = g.sesiones.map((s, i) => ({ s, i })).filter(({ s }) => !s.excluida);
  return !g.errores.length && valid.length === 2 && valid[0].s.dia !== valid[1].s.dia && valid.every(({ s }) => s.aula)
    ? valid.map(({ i }) => i) : [];
}
