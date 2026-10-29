const SECCIONES = [
  { titulo: "Sobre SGIAC", contenido: "SGIAC (Sistema de Gestión Integral de Aulas y Comunicaciones de Kardex) es la plataforma institucional de la Carrera de Informática para centralizar la gestión académica de aulas, horarios, comunicados y atención al estudiante." },
  { titulo: "Misión de la carrera", contenido: "Formar profesionales en Informática con sólidas bases científicas, tecnológicas y éticas, capaces de diseñar, desarrollar e implementar soluciones tecnológicas que contribuyan al desarrollo institucional y regional." },
  { titulo: "Contacto general", contenido: "Secretaría de la Carrera de Informática — Bloque A, piso 2. Horario de atención: lunes a viernes de 8:00 a 16:00." },
];
export default function InformacionPage() {
  return <div className="container-public max-w-3xl py-14">
    <h1 className="text-3xl font-extrabold text-slate-800">Información institucional</h1>
    <p className="mt-1 text-slate-500">Conoce más sobre la Carrera de Informática y el sistema SGIAC.</p>
    <div className="mt-10 space-y-8">{SECCIONES.map(s => <section key={s.titulo} className="card p-6"><h2 className="mb-2 text-lg font-bold text-slate-800">{s.titulo}</h2><p className="text-slate-600">{s.contenido}</p></section>)}</div>
  </div>;
}
