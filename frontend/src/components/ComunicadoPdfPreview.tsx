import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export function ComunicadoPdfPreview({ url, titulo }: { url?: string; titulo: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    setListo(false);
    if (!container || !canvas || !url) return;
    let cancelado = false;
    let tarea: PDFDocumentLoadingTask | undefined;

    async function cargar() {
      try {
        // Se carga el lector únicamente para los PDF que llegan a la pantalla.
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        if (cancelado) return;
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        tarea = getDocument({ url, withCredentials: true });
        const documento = await tarea.promise;
        if (cancelado) return;
        const pagina = await documento.getPage(1);
        if (cancelado) return;
        const original = pagina.getViewport({ scale: 1 });
        const viewport = pagina.getViewport({ scale: Math.min(640 / original.width, 880 / original.height) });
        canvas!.width = Math.ceil(viewport.width);
        canvas!.height = Math.ceil(viewport.height);
        await pagina.render({ canvas: canvas!, viewport }).promise;
        if (!cancelado) setListo(true);
      } catch {
        // PDF protegido, dañado o sin conexión: la portada sigue siendo visible.
      }
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        void cargar();
      }
    }, { rootMargin: "200px" });
    observer.observe(container);
    return () => {
      cancelado = true;
      observer.disconnect();
      void tarea?.destroy().catch(() => {});
    };
  }, [url]);

  return (
    <div ref={containerRef} className={`comunicado-pdf-preview${listo ? " comunicado-pdf-preview--listo" : ""}`} aria-hidden="true">
      <div className="comunicado-pdf-portada">
        <svg viewBox="0 0 48 56" fill="none" aria-hidden="true"><path d="M8 2h22l12 12v40H8z" fill="#fff" stroke="currentColor" strokeWidth="2" /><path d="M30 2v13h12M16 35h18M16 41h14" stroke="currentColor" strokeWidth="2" /><rect x="2" y="19" width="32" height="13" rx="3" fill="currentColor" /><text x="18" y="28.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="700">PDF</text></svg>
        <p>{titulo}</p>
        <span>Documento adjunto</span>
      </div>
      <canvas ref={canvasRef} />
      <span className="comunicado-pdf-etiqueta">{listo ? "PDF · Primera página" : "Documento PDF"}</span>
    </div>
  );
}
