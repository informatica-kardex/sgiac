import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { auxiliarCarnetApi, CarnetAuxiliar, enlaceCarnet } from '../api/auxiliar-carnet.api';
import { crearCarnetPdf } from '../utils/auxiliarCarnetPdf';
import { mensajeError } from '../hooks/usePolling';
import { Modal } from '../admin/components/Modal';

function CarasCarnet({ url }: { url: string }) {
  const frente = useRef<HTMLCanvasElement>(null), reverso = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    setReady(false); setError('');
    void (async () => {
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
      if (cancelled) return;
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      task = getDocument({ url });
      const pdf = await task.promise;
      for (const [index, ref] of [frente, reverso].entries()) {
        if (cancelled) return;
        const page = await pdf.getPage(index + 1);
        if (cancelled || !ref.current) return;
        const viewport = page.getViewport({ scale: 3 });
        ref.current.width = Math.ceil(viewport.width); ref.current.height = Math.ceil(viewport.height);
        await page.render({ canvas: ref.current, viewport }).promise;
      }
      if (!cancelled) setReady(true);
    })().catch(() => { if (!cancelled) setError('No se pudo mostrar la vista previa. Puedes abrir o descargar el PDF.'); });
    return () => { cancelled = true; void task?.destroy().catch(() => {}); };
  }, [url]);
  return <div>
    {!ready && <p role="status" className="mb-3 text-sm text-slate-600">{error || 'Preparando vista previa…'}</p>}
    <div className={`grid gap-4 sm:grid-cols-2 ${ready ? '' : 'hidden'}`}>
      {[frente, reverso].map((ref, i) => <figure key={i}><canvas ref={ref} role="img" aria-label={i ? 'Reverso del carnet con QR de consulta' : 'Frente del carnet con datos del auxiliar'} className="h-auto w-full rounded-xl border border-slate-200 bg-white shadow-sm" /><figcaption className="mt-2 text-center text-xs text-slate-500">{i ? 'Reverso · QR del horario' : 'Frente · Identificación'}</figcaption></figure>)}
    </div>
  </div>;
}

type CarnetProps = { onClose: () => void } & ({ propio: true; idAuxiliar?: never } | { propio?: false; idAuxiliar: string });
export function AuxiliarCarnetModal({ idAuxiliar, propio, onClose }: CarnetProps) {
  const [result, setResult] = useState<{ carnet: CarnetAuxiliar; enlace: string; pdf: string } | null>(null);
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false, objectUrl = '';
    setResult(null); setError('');
    void (async () => {
      const carnet = propio ? await auxiliarCarnetApi.miCarnet() : await auxiliarCarnetApi.emitir(idAuxiliar!);
      const enlace = enlaceCarnet(carnet.token);
      const blob = await crearCarnetPdf(carnet, enlace);
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setResult({ carnet, enlace, pdf: objectUrl });
    })().catch(e => { if (!cancelled) setError(e instanceof Error && e.message.startsWith('Configura VITE_PUBLIC_SITE_URL') ? e.message : mensajeError(e)); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [idAuxiliar, propio, attempt]);
  const local = result && /^(localhost|127\..*|\[::1\]|0\.0\.0\.0)$/i.test(new URL(result.enlace).hostname);
  return <Modal title="Carnet del auxiliar" open onClose={onClose} size="wide">
    <div className="space-y-5">
      {error ? <div role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900"><p>{error}</p><button className="btn-secondary mt-3" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div> : !result ? <p role="status">Generando carnet y QR…</p> : <>
        <p className="font-semibold">{result.carnet.nombreCompleto}</p>
        <CarasCarnet url={result.pdf} />
        {!!result.carnet.materias?.length && <div className="text-sm text-slate-700"><p className="font-semibold">Materias vinculadas</p><ul className="mt-1 list-inside list-disc">{result.carnet.materias.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}</ul></div>}
        <p className="text-sm text-slate-600">El PDF contiene el frente y el reverso del carnet (85,6 × 54 mm). Imprime a tamaño real, al 100 %. El QR abre el aula, día y horario actualizados, sin iniciar sesión.</p>
        {local && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Este carnet usa una dirección local y no abrirá desde otro celular. Antes de entregarlo, configura la dirección pública del sistema y vuelve a generar el PDF.</p>}
        <div className="flex flex-wrap gap-3">
          <a className="btn-primary" href={result.pdf} download={`carnet-auxiliar-${result.carnet.idAuxiliar}.pdf`}>Descargar carnet PDF</a>
          <a className="btn-secondary" href={result.pdf} target="_blank" rel="noopener noreferrer">Abrir / imprimir</a>
          <a className="btn-secondary" href={result.enlace} target="_blank" rel="noopener noreferrer">Ver horario público</a>
        </div>
        <p className="break-all text-xs text-slate-500">Enlace del QR: {result.enlace}</p>
      </>}
      <div className="flex justify-end"><button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button></div>
    </div>
  </Modal>;
}
