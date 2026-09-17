const ESTADO_STYLES: Record<string, string> = {
  disponible: "bg-emerald-50 text-emerald-700",
  publicado: "bg-emerald-50 text-emerald-700",
  publicada: "bg-emerald-50 text-emerald-700",
  activo: "bg-emerald-50 text-emerald-700",
  atendida: "bg-emerald-50 text-emerald-700",

  mantenimiento: "bg-amber-50 text-amber-700",
  borrador: "bg-amber-50 text-amber-700",
  pendiente: "bg-amber-50 text-amber-700",
  en_proceso: "bg-sky-50 text-sky-700",

  inhabilitada: "bg-red-50 text-red-700",
  archivado: "bg-slate-100 text-slate-600",
  inactivo: "bg-red-50 text-red-700",
  rechazada: "bg-red-50 text-red-700",
};

const ESTADO_LABEL: Record<string, string> = {
  en_proceso: "En proceso",
};

export function EstadoBadge({ estado }: { estado: string }) {
  const style = ESTADO_STYLES[estado] ?? "bg-slate-100 text-slate-600";
  const label = ESTADO_LABEL[estado] ?? estado.charAt(0).toUpperCase() + estado.slice(1);
  return <span className={`badge ${style}`}>{label}</span>;
}
