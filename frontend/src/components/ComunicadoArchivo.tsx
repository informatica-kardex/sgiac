export function ComunicadoArchivo({ url, nombre, tipo, compact = false }: {
  url: string; nombre: string; tipo: string; compact?: boolean;
}) {
  if (tipo.startsWith("image/")) return <img src={url} alt={nombre} loading="lazy" className={`w-full rounded-lg bg-slate-50 object-contain ${compact ? "max-h-64" : "max-h-[80vh]"}`} />;
  if (tipo === "application/pdf") return <div className="space-y-3">
    <iframe src={url} title={`PDF: ${nombre}`} className={`w-full rounded-lg border border-slate-200 ${compact ? "h-72" : "h-[70vh] min-h-96"}`} />
    <p className="text-sm text-slate-600">Si el PDF no se muestra en tu dispositivo, <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-700 underline">ábrelo en otra pestaña</a>.</p>
  </div>;
  return <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-700 underline">{nombre}</a>;
}
