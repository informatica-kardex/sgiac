import { Link } from "react-router-dom";

export function Footer({ portal = false }: { portal?: boolean }) {
  return <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
    <div className="container-public grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0 break-words"><Link to="/" aria-label="Kardex — Inicio" className="mb-3 inline-flex p-2"><img src="/images/kardex.png" alt="Kardex — Carrera de Informática" width={640} height={640} loading="lazy" className="h-24 w-24 object-contain" /></Link><p className="text-sm text-slate-400">{portal ? "Carrera de Informática" : "Sistema de Gestión Integral de Aulas y Comunicaciones de Kardex — Carrera de Informática."}</p></div>
      <div className="min-w-0 break-words"><p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Navegación</p><ul className="space-y-2 text-sm text-slate-400"><li><Link to="/comunicados" className="hover:text-white">Comunicados</Link></li><li><Link to="/horarios" className="hover:text-white">Horarios</Link></li><li><Link to="/faq" className="hover:text-white">Preguntas frecuentes</Link></li><li><Link to="/atencion" className="hover:text-white">Atención Kardex</Link></li></ul></div>
      <div className="min-w-0 break-words"><p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Atención Kardex</p><ul className="space-y-2 text-sm text-slate-400"><li>Lunes a viernes, 8:00 - 16:00</li><li>Bloque C, planta baja</li><li>kardex.informatica@universidad.edu.bo</li></ul></div>
      <div className="min-w-0 break-words"><p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Acceso institucional</p><Link to="/login" className="text-sm text-primary-300 hover:text-primary-200">Ingresar a mi cuenta →</Link></div>
    </div>
    <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500"><nav aria-label="Políticas del sistema" className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2 px-4 text-slate-300"><Link to="/privacidad" className="underline underline-offset-2 hover:text-white">Privacidad</Link><Link to="/seguridad" className="underline underline-offset-2 hover:text-white">Seguridad y uso responsable</Link><Link to="/cookies" className="underline underline-offset-2 hover:text-white">Cookies</Link></nav>© {new Date().getFullYear()} {portal ? "Kardex" : "SGIAC"} — Carrera de Informática. Todos los derechos reservados.</div>
  </footer>;
}

