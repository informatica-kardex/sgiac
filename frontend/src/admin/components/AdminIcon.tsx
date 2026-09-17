export type AdminIconName = "auditoria" | "dashboard" | "aulas" | "horarios" | "comunicados" | "faq" | "fichas" | "reportes" | "usuarios" | "roles" | "configuracion" | "logout" | "book" | "menu" | "close" | "arrow" | "clock";
const paths: Record<AdminIconName, string> = {
  auditoria: "M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  aulas: "M8 21V3h9v18 M8 8H3v13h18V11h-4 M11 7h3 M11 11h3 M11 15h3 M11 21v-3h3v3",
  horarios: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M7 3v4 M17 3v4 M3 11h18 M7 15h2 M15 15h2 M7 18h2",
  comunicados: "M5 3h9l5 5v13H5Z M14 3v6h5 M8 13h8 M8 17h6",
  faq: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  fichas: "M9 5H5v16h14V5h-4 M9 3h6v4H9z M8 11h8 M8 15h8 M8 18h5",
  reportes: "M5 3h9l5 5v13H5z M14 3v6h5 M8 17v-3 M12 17v-6 M16 17v-4",
  usuarios: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.9 M16 3a4 4 0 0 1 0 8 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  roles: "M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6",
  configuracion: "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  logout: "M9 3H4v18h5 M9 12h12 M17 8l4 4-4 4",
  book: "M12 5v16 M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1 M5 8h4 M5 12h4 M15 8h4 M15 12h4",
  menu: "M3 6h18 M3 12h18 M3 18h18", close: "M6 6l12 12 M6 18 18 6",
  arrow: "M4 12h16 M14 6l6 6-6 6", clock: "M12 7v5h4 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
export function AdminIcon({ name, className = "", size = 18 }: { name: AdminIconName; className?: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true"><path d={paths[name]} /></svg>;
}
