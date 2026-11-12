import { forwardRef, memo, type CSSProperties, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { ListItem } from "@tiptap/extension-list";
import { documentoEditor, textoEditor } from "../utils/comunicadoEditor";
import "../styles/comunicado-editor.css";

type Accion = "bold" | "italic" | "bulletList" | "orderedList" | "limpiar" | "undo" | "redo";
type Props = {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  name: string;
  id: string;
  invalido?: boolean;
  disabled?: boolean;
  mayusculas: boolean;
  tamanoLetra: number;
  onMayusculasChange: (value: boolean) => void;
  onTamanoLetraChange: (value: number) => void;
};

const acciones = [
  ["bold", "Negrita", "Ctrl+B"], ["italic", "Cursiva", "Ctrl+I"],
  ["bulletList", "Lista con viñetas", ""], ["orderedList", "Lista numerada", ""],
  ["limpiar", "Quitar formato", ""],
] as const;
const extensiones = [
  StarterKit.configure({
    heading: false, blockquote: false, code: false, codeBlock: false, horizontalRule: false,
    strike: false, underline: false, link: false, trailingNode: false, listItem: false,
  }),
  // La conversión agrupa primero los párrafos seleccionados y luego los divide en elementos.
  // Se permiten varios párrafos durante ese paso, manteniendo las listas de un solo nivel.
  ListItem.extend({ content: "paragraph+" }),
];

function Icono({ accion }: { accion: Accion }) {
  if (accion === "bold") return <strong aria-hidden="true">B</strong>;
  if (accion === "italic") return <em aria-hidden="true">I</em>;
  const trazos: Record<Exclude<Accion, "bold" | "italic">, string> = {
    bulletList: "M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01",
    orderedList: "M10 6h11M10 12h11M10 18h11M3 3h1v6M3 9h2M2 15c0-3 4-3 4-1 0 1-4 4-4 5h4",
    limpiar: "M4 4h12M10 4l-4 14M14 14l7 7M21 14l-7 7",
    undo: "M8 5 3 10l5 5M3 10h10a7 7 0 0 1 7 7v2",
    redo: "m16 5 5 5-5 5M21 10H11a7 7 0 0 0-7 7v2",
  };
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={trazos[accion]} /></svg>;
}

export const ComunicadoTextoEditor = memo(forwardRef<{ focus: () => void }, Props>(function ComunicadoTextoEditor({ value, onChange, onBlur, name, id, invalido, disabled = false, mayusculas, tamanoLetra, onMayusculasChange, onTamanoLetraChange }, ref) {
  const contenedor = useRef<HTMLDivElement>(null);
  const ultimoValor = useRef(value);
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | Window>(window);
  // No volver a interpretar todo el comunicado en cada pulsación o cambio de selección.
  const [contenidoInicial] = useState(() => documentoEditor(value));
  const [palabras, setPalabras] = useState(0);
  const [tamano, setTamano] = useState(String(tamanoLetra));
  const editor = useEditor({
    extensions: extensiones,
    content: contenidoInicial,
    editable: !disabled,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        id, role: "textbox", "aria-label": "Texto del comunicado", "aria-multiline": "true",
        "aria-describedby": `${id}-ayuda`, class: "comunicado-editor-contenido",
      },
    },
    onUpdate: ({ editor: actual }) => {
      const nuevo = actual.isEmpty ? "" : textoEditor(actual.getJSON());
      ultimoValor.current = nuevo;
      onChange(nuevo);
    },
    onBlur: () => onBlur(),
  });
  const estado = useEditorState({ editor, selector: ({ editor: actual }) => actual ? {
    bold: actual.isActive("bold"), italic: actual.isActive("italic"),
    bulletList: actual.isActive("bulletList"), orderedList: actual.isActive("orderedList"),
    undo: actual.can().undo(), redo: actual.can().redo(), vacio: actual.isEmpty,
  } : null });
  const opcionesBurbuja = useMemo(() => ({
    placement: "top" as const, strategy: "fixed" as const, offset: 10,
    flip: { padding: 8 }, shift: { padding: 8 }, scrollTarget,
  }), [scrollTarget]);

  useImperativeHandle(ref, () => ({ focus: () => { editor?.commands.focus(); } }), [editor]);
  useEffect(() => { setScrollTarget(contenedor.current?.closest<HTMLElement>('[role="dialog"]') ?? window); }, []);
  useEffect(() => {
    if (editor && value !== ultimoValor.current) {
      ultimoValor.current = value;
      editor.commands.setContent(documentoEditor(value), { emitUpdate: false });
    }
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => { editor?.view.dom.setAttribute("aria-invalid", String(!!invalido)); }, [editor, invalido]);
  useEffect(() => { setTamano(String(tamanoLetra)); }, [tamanoLetra]);
  useEffect(() => {
    if (!editor) return;
    let timer: number;
    const contar = () => setPalabras(editor.getText().trim().split(/\s+/).filter(Boolean).length);
    const programar = () => { window.clearTimeout(timer); timer = window.setTimeout(contar, 250); };
    contar();
    editor.on("update", programar);
    return () => { window.clearTimeout(timer); editor.off("update", programar); };
  }, [editor]);

  function cambiarTamano(texto: string) {
    setTamano(texto);
    const numero = Number(texto);
    if (Number.isInteger(numero) && numero >= 8 && numero <= 72) onTamanoLetraChange(numero);
  }

  function aplicar(accion: Accion) {
    if (!editor || disabled) return;
    const cadena = editor.chain().focus();
    switch (accion) {
      case "bold": cadena.toggleBold().run(); break;
      case "italic": cadena.toggleItalic().run(); break;
      case "bulletList": cadena.toggleBulletList().run(); break;
      case "orderedList": cadena.toggleOrderedList().run(); break;
      case "limpiar": cadena.unsetAllMarks().clearNodes().run(); break;
      case "undo": cadena.undo().run(); break;
      case "redo": cadena.redo().run(); break;
    }
  }

  function boton(accion: Accion, etiqueta: string, atajo = "") {
    const formato = accion === "bold" || accion === "italic" || accion === "bulletList" || accion === "orderedList";
    return <button key={accion} type="button" className="comunicado-editor-boton" aria-label={etiqueta}
      title={etiqueta + (atajo ? ` (${atajo})` : "")} aria-pressed={formato ? !!estado?.[accion] : undefined}
      disabled={disabled || !editor || ((accion === "undo" || accion === "redo") && !estado?.[accion])}
      onMouseDown={event => event.preventDefault()} onClick={() => aplicar(accion)}>
      <Icono accion={accion} />
    </button>;
  }

  return <div ref={contenedor} className="comunicado-editor" data-invalido={invalido || undefined} data-disabled={disabled || undefined}
    style={{ "--comunicado-tamano": `${tamanoLetra}pt`, "--comunicado-mayusculas": mayusculas ? "uppercase" : "none" } as CSSProperties}>
    <div className="comunicado-editor-barra">
      <div role="group" aria-label="Formato del texto" className="comunicado-editor-herramientas">
        {acciones.map(([accion, etiqueta, atajo]) => boton(accion, etiqueta, atajo))}
        <span className="comunicado-editor-divisor" />
        {boton("undo", "Deshacer", "Ctrl+Z")}{boton("redo", "Rehacer", "Ctrl+Shift+Z")}
        <span className="comunicado-editor-divisor" />
        <button type="button" className="comunicado-editor-boton comunicado-editor-mayusculas" aria-label="Todo en mayúsculas"
          title="Todo en mayúsculas" aria-pressed={mayusculas} disabled={disabled}
          onMouseDown={event => event.preventDefault()} onClick={() => { onMayusculasChange(!mayusculas); editor?.commands.focus(); }}>Aa</button>
        <label className="comunicado-editor-tamano" title="Tamaño de letra del comunicado">
          <span className="sr-only">Tamaño de letra</span>
          <input type="number" min={8} max={72} step={1} value={tamano} disabled={disabled} aria-label="Tamaño de letra"
            onChange={event => cambiarTamano(event.target.value)} onBlur={() => setTamano(String(tamanoLetra))}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setTamano(String(tamanoLetra)); editor?.commands.focus(); } }} />
        </label>
      </div>
    </div>
    <div className="comunicado-editor-papel" data-vacio={estado?.vacio ?? true}>
      <EditorContent editor={editor} />
    </div>
    {editor && !disabled && <BubbleMenu editor={editor} pluginKey="comunicado-formato" updateDelay={50}
      appendTo={scrollTarget instanceof HTMLElement ? scrollTarget : document.body} options={opcionesBurbuja}
      className="comunicado-editor-burbuja" role="group" aria-label="Formato de la selección">
      {acciones.map(([accion, etiqueta, atajo]) => boton(accion, etiqueta, atajo))}
    </BubbleMenu>}
    <input type="hidden" name={name} value={value} />
    <div className="comunicado-editor-pie">
      <p id={`${id}-ayuda`}>Selecciona texto para darle formato. Enter crea un párrafo; Mayús+Enter, un salto de línea.</p>
      <span>{palabras} {palabras === 1 ? "palabra" : "palabras"}</span>
    </div>
  </div>;
}));
