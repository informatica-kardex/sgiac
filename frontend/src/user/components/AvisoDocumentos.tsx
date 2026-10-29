import { useCallback } from "react";
import { Link } from "react-router-dom";
import { documentosApi } from "../../api/documentos.api";
import { usePolling } from "../../hooks/usePolling";
import { fechaDocumento } from "../../components/DocumentoDetalle";

export function AvisoDocumentos() {
  const load = useCallback(async () => (await documentosApi.portal()).data.data.solicitudes.filter(s => s.estado === "LISTA"), []);
  const { data, error } = usePolling(load, 30000);
  if (error) return <p className="text-sm text-slate-500">No se pudieron actualizar tus avisos de documentos. <Link to="/usuario/documentos" className="underline">Consultar solicitudes</Link></p>;
  if (!data?.length) return null;
  return <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="text-xl font-bold text-emerald-950">Tienes {data.length} {data.length === 1 ? "documento listo" : "documentos listos"} para recoger</h2><ul className="mt-3 space-y-2 text-sm text-emerald-900">{data.map(s => <li key={s.id}><strong>{s.codigo}</strong> · {s.documento} · Desde {fechaDocumento(s.fechaRecojo)} · Trae {s.hojas} hojas.</li>)}</ul><Link className="btn-primary mt-4" to="/usuario/documentos">Ver ficha e indicaciones de recojo</Link></section>;
}
