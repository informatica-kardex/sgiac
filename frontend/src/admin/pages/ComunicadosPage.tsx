import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { comunicadosApi, comunicadoArchivoUrl } from "../../api/comunicados.api";
import { ComunicadoArchivo } from "../../components/ComunicadoArchivo";
import { Comunicado } from "../../api/types";
import { ComunicadoFormData, comunicadoSchema } from "../../utils/validators";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AlertMessage } from "../components/AlertMessage";
import { formatFecha } from "../../utils/formatters";

export default function ComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Comunicado | null>(null);
  const [aEliminar, setAEliminar] = useState<Comunicado | null>(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [adjuntosEliminar, setAdjuntosEliminar] = useState<string[]>([]);
  const [errorPagina, setErrorPagina] = useState("");
  const mensajeError = (e: unknown) => e instanceof AxiosError ? e.response?.data?.details?.[0]?.mensaje || e.response?.data?.message || "No se pudo completar la operación" : "No se pudo completar la operación";

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ComunicadoFormData>({
    resolver: zodResolver(comunicadoSchema),
    defaultValues: { estado: "borrador", tipo: "texto", contenido: "" },
  });
  const tipo = watch("tipo");
  const adjuntosActuales = (editando?.adjuntos ?? []).filter(a => !adjuntosEliminar.includes(a.idAdjunto)
    && (tipo === "pdf" ? a.tipo === "application/pdf" : tipo === "imagen" && a.tipo.startsWith("image/")));
  useEffect(() => {
    const nuevos = archivos.map(file => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(nuevos);
    return () => nuevos.forEach(item => URL.revokeObjectURL(item.url));
  }, [archivos]);

  const limpiarArchivos = () => { setArchivos([]); setAdjuntosEliminar([]); };

  const cargar = () => {
    setCargando(true);
    setErrorPagina("");
    comunicadosApi
      .listar()
      .then(({ data }) => setComunicados(data.data))
      .catch(e => setErrorPagina(mensajeError(e)))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const abrirCrear = () => {
    setEditando(null);
    reset({ titulo: "", tipo: "texto", contenido: "", categoria: "", estado: "borrador" });
    limpiarArchivos(); setError("");
    setModalAbierto(true);
  };

  const abrirEditar = (c: Comunicado) => {
    setEditando(c);
    reset(c);
    limpiarArchivos(); setError("");
    setModalAbierto(true);
  };

  const onSubmit = async (data: ComunicadoFormData) => {
    setError("");
    if (data.tipo !== "texto" && !archivos.length && !adjuntosActuales.length) { setError(data.tipo === "imagen" ? "Añade al menos una imagen al comunicado." : "Selecciona el PDF que quieres publicar."); return; }
    setGuardando(true);
    try {
      if (editando) {
        await comunicadosApi.actualizar(editando.idComunicado, { ...data, adjuntosEliminar }, data.tipo === "texto" ? [] : archivos);
      } else {
        await comunicadosApi.crear(data, data.tipo === "texto" ? [] : archivos);
      }
      setModalAbierto(false);
      limpiarArchivos();
      cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar) return;
    setGuardando(true);
    try {
      await comunicadosApi.eliminar(aEliminar.idComunicado);
      setAEliminar(null);
      cargar();
    } catch (e) {
      setErrorPagina(mensajeError(e)); setAEliminar(null);
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async (c: Comunicado) => {
    setGuardando(true);
    try { await comunicadosApi.publicar(c.idComunicado); cargar(); }
    catch (e) { setErrorPagina(mensajeError(e)); }
    finally { setGuardando(false); }
  };

  const archivar = async (c: Comunicado) => {
    setGuardando(true);
    try { await comunicadosApi.archivar(c.idComunicado); cargar(); }
    catch (e) { setErrorPagina(mensajeError(e)); }
    finally { setGuardando(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Comunicados</h1>
          <p className="text-sm text-slate-500">Publica texto, imágenes o documentos PDF para el portal.</p>
        </div>
        <button className="btn-primary" disabled={guardando} onClick={abrirCrear}>+ Nuevo comunicado</button>
      </div>

      {errorPagina && <AlertMessage type="error" message={errorPagina} />}
      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comunicados.map((c) => (
                <tr key={c.idComunicado}>
                  <td className="px-4 py-3 font-medium text-slate-700">{c.titulo}<span className="mt-1 block text-xs font-normal text-slate-400">{c.tipo === "pdf" ? "PDF" : c.tipo === "imagen" ? "Imagen" : "Texto"}</span></td>
                  <td className="px-4 py-3 text-slate-500">{c.categoria}</td>
                  <td className="px-4 py-3 text-slate-500">{formatFecha(c.fechaPublicacion)}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={c.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    {c.estado !== "publicado" && (
                      <button disabled={guardando} className="btn-ghost text-emerald-700" onClick={() => publicar(c)}>
                        Publicar
                      </button>
                    )}
                    {c.estado !== "archivado" && (
                      <button disabled={guardando} className="btn-ghost" onClick={() => archivar(c)}>Archivar</button>
                    )}
                    <button disabled={guardando} className="btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                    <button disabled={guardando} className="btn-ghost text-red-600" onClick={() => setAEliminar(c)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!comunicados.length && !errorPagina && <p className="p-6 text-sm text-slate-500">Todavía no hay comunicados. Crea el primero con el botón superior.</p>}
        </div>
      )}

      <Modal
        title={editando ? "Editar comunicado" : "Nuevo comunicado"}
        open={modalAbierto}
        onClose={() => { if (!guardando) { setModalAbierto(false); limpiarArchivos(); } }}
      >
        {error && <div className="mb-4"><AlertMessage type="error" message={error} /></div>}
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <fieldset disabled={guardando} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Tipo de publicación<select className="select-field mt-1" {...register("tipo", { onChange: () => { limpiarArchivos(); setError(""); } })}><option value="texto">Texto</option><option value="imagen">Imágenes</option><option value="pdf">Documento PDF</option></select></label>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Título</label>
            <input className="input-field" {...register("titulo")} />
            {errors.titulo && <p className="text-xs text-red-600">{errors.titulo.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Categoría</label>
              <input className="input-field" {...register("categoria")} />
              {errors.categoria && <p className="text-xs text-red-600">{errors.categoria.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Estado</label>
              <select className="select-field" {...register("estado")}>
                <option value="borrador">Borrador</option>
                <option value="publicado">Publicado</option>
                <option value="archivado">Archivado</option>
              </select>
            </div>
          </div>
          {tipo !== "texto" && <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">{tipo === "imagen" ? "Añadir imágenes" : adjuntosActuales.length ? "Reemplazar PDF (opcional)" : "Documento PDF"}
              <input key={`${editando?.idComunicado ?? "nuevo"}-${tipo}-${modalAbierto}`} type="file" multiple={tipo === "imagen"} className="input-field mt-1" accept={tipo === "pdf" ? ".pdf,application/pdf" : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"} onChange={e => {
                const seleccionados = Array.from(e.target.files ?? []); e.target.value = ""; setError("");
                if (!seleccionados.length) return;
                if (seleccionados.some(file => file.size === 0 || file.size > 10 * 1024 * 1024)) { setError("Cada archivo debe pesar hasta 10 MB y no estar vacío."); return; }
                if (seleccionados.some(file => tipo === "imagen" ? !/\.(jpe?g|png|webp)$/i.test(file.name) : !/\.pdf$/i.test(file.name))) { setError(tipo === "imagen" ? "Selecciona imágenes JPG, PNG o WebP." : "Selecciona un documento PDF."); return; }
                if (tipo === "imagen" && adjuntosActuales.length + archivos.length + seleccionados.length > 10) { setError("Puedes añadir hasta 10 imágenes por comunicado. Retira alguna antes de añadir más."); return; }
                setArchivos(prev => tipo === "imagen" ? [...prev, ...seleccionados] : seleccionados.slice(0, 1));
              }} />
            </label>
            <p className="text-xs text-slate-500">{tipo === "pdf" ? "Un PDF de hasta 10 MB." : "Hasta 10 imágenes JPG, PNG o WebP de 10 MB cada una. Puedes seleccionarlas juntas o añadirlas por partes."}</p>
            {tipo === "imagen" && <p className="text-xs text-slate-600">{adjuntosActuales.length + archivos.length}/10 imágenes. Con más de una se mostrarán en un carrusel automático.</p>}
            <div className={tipo === "imagen" ? "grid grid-cols-2 gap-3" : "space-y-3"}>
              {!(tipo === "pdf" && archivos.length) && adjuntosActuales.map(adj => <div key={adj.idAdjunto} className="min-w-0 rounded-xl border border-slate-200 p-2" data-adjunto-id={adj.idAdjunto}>
                <ComunicadoArchivo url={comunicadoArchivoUrl(adj.url)} nombre={adj.nombre} tipo={adj.tipo} compact />
                <p className="mt-2 truncate text-xs text-slate-600" title={adj.nombre}>{adj.nombre}</p>
                <button type="button" className="mt-1 min-h-9 text-xs font-semibold text-red-700 hover:underline" aria-label={`Retirar ${adj.nombre}`} onClick={() => { setAdjuntosEliminar(prev => [...prev, adj.idAdjunto]); setError(""); }}>Retirar</button>
              </div>)}
              {previews.filter(item => archivos.includes(item.file)).map(({ file, url }) => <div key={url} className="min-w-0 rounded-xl border border-primary-200 bg-primary-50/30 p-2" data-nuevo-archivo={file.name}>
                <ComunicadoArchivo url={url} nombre={file.name} tipo={tipo === "pdf" ? "application/pdf" : "image/preview"} compact />
                <p className="mt-2 truncate text-xs text-slate-600" title={file.name}>{file.name} · Nuevo</p>
                <button type="button" className="mt-1 min-h-9 text-xs font-semibold text-red-700 hover:underline" aria-label={`Retirar ${file.name}`} onClick={() => { setArchivos(prev => prev.filter(item => item !== file)); setError(""); }}>Retirar</button>
              </div>)}
            </div>
            {adjuntosEliminar.length > 0 && <p className="text-xs text-slate-600">Los archivos retirados se eliminarán al guardar. <button type="button" className="font-semibold text-primary-700 underline" onClick={() => { setAdjuntosEliminar([]); setArchivos([]); setError(""); }}>Deshacer cambios de archivos</button></p>}
          </div>}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">{tipo === "texto" ? "Texto del comunicado" : "Descripción (opcional)"}</label>
            <textarea className="textarea-field" rows={5} {...register("contenido")} />
            {tipo === "texto" && <p className="text-xs text-slate-500">Se mostrará en una hoja membretada con los logos institucionales. Usa **texto** para resaltar en negrita y una línea en blanco para separar párrafos.</p>}
            {errors.contenido && <p className="text-xs text-red-600">{errors.contenido.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setModalAbierto(false); limpiarArchivos(); }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(aEliminar)}
        title="Eliminar comunicado"
        message={`¿Seguro que deseas eliminar "${aEliminar?.titulo}"?`}
        onCancel={() => setAEliminar(null)}
        onConfirm={confirmarEliminar}
        loading={guardando}
      />
    </div>
  );
}
