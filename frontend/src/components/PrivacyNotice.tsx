import { Link } from "react-router-dom";

export function PrivacyNotice({ context }: { context: "registro" | "atencion" }) {
  return (
    <aside aria-label="Información sobre tus datos" className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
      <p>
        {context === "registro"
          ? "Tus datos personales y académicos se utilizarán para crear y administrar tu cuenta institucional."
          : "Tu nombre, correo y el contenido de esta solicitud se utilizarán para gestionar tu atención en Kardex. No incluyas contraseñas ni códigos de acceso."}
      </p>
      <p className="mt-1">
        Consulta la <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-700 underline underline-offset-2">política de privacidad<span className="sr-only"> (se abre en otra pestaña)</span></Link>
        {" y la "}<Link to="/seguridad" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-700 underline underline-offset-2">política de seguridad<span className="sr-only"> (se abre en otra pestaña)</span></Link>.
        {" Los enlaces se abren en otra pestaña para conservar tu formulario."}
      </p>
    </aside>
  );
}
