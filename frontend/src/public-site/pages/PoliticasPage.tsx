import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";

type Politica = "privacidad" | "seguridad" | "cookies";

const POLITICAS: Record<Politica, {
  titulo: string;
  descripcion: string;
  secciones: { titulo: string; contenido: string[] }[];
}> = {
  privacidad: {
    titulo: "Política de privacidad",
    descripcion: "Conoce qué datos utiliza SGIAC y para qué se solicitan.",
    secciones: [
      {
        titulo: "Ámbito y atención de consultas",
        contenido: [
          "Esta información corresponde al portal y al panel administrativo de SGIAC, el sistema de la Carrera de Informática para la gestión de aulas, comunicaciones y atención Kardex. Puedes consultar la información pública sin crear una cuenta.",
          "Para consultas sobre tus datos, dirígete a la Secretaría de la Carrera de Informática o a la oficina de Kardex y solicita atención del personal responsable de SGIAC.",
        ],
      },
      {
        titulo: "Datos que se solicitan",
        contenido: [
          "Al registrarte se solicitan nombres, apellidos, cédula de identidad, correo, registro universitario, carrera, semestre, gestión y contraseña. Estos datos permiten identificar tu cuenta y asociarla con tu información académica. La contraseña se almacena mediante una transformación de seguridad que permite verificarla sin guardar su texto original.",
          "Al solicitar atención se reciben tu nombre, correo, motivo y detalle del trámite. Incluye únicamente la información necesaria para atender tu solicitud; no escribas contraseñas, códigos de acceso ni datos de otras personas que no sean necesarios.",
          "El uso del servicio también genera información técnica, como dirección IP, navegador, fechas de acceso y eventos de autenticación, para gestionar sesiones, registrar actividad y detectar uso indebido.",
        ],
      },
      {
        titulo: "Finalidades y acceso a la información",
        contenido: [
          "Los datos se utilizan para crear y administrar cuentas, tramitar solicitudes de atención, enviar mensajes de acceso o recuperación y proteger el servicio. Los campos obligatorios son necesarios para procesar el formulario correspondiente.",
          "El personal autorizado accede a la información según los permisos de su función. Los proveedores de alojamiento, almacenamiento y correo intervienen en el procesamiento necesario para operar el servicio; por ejemplo, el proveedor de correo recibe la dirección de destino y el contenido del mensaje de verificación.",
          "Los formularios de registro y atención no publican tus datos en el portal público. El portal no incorpora publicidad ni herramientas de seguimiento publicitario.",
        ],
      },
      {
        titulo: "Solicitudes de documentos y avisos voluntarios",
        contenido: [
          "Al solicitar un documento académico se registra el tipo, motivo, ficha de recojo, fechas, requisitos, cantidad de hojas y seguimiento del trámite. El estudiante consulta sus propias solicitudes y el personal autorizado gestiona la preparación y entrega. El sistema puede enviar el aviso de recojo al correo verificado de la cuenta.",
          "El bot público de Telegram permite consultar preguntas sin vincular una cuenta. Dentro de tu sesión puedes elegir vincular Telegram para recibir avisos personales y consultar tus solicitudes. Al confirmar el enlace se asocia el identificador de tu chat privado con tu cuenta. Telegram recibe los mensajes de aviso, que incluyen ficha, documento, fecha, lugar y hojas a traer; no se envían tus notas académicas.",
          "Puedes desvincular Telegram desde Mis documentos o con /desvincular en el bot. Se elimina la asociación con el chat y se detienen los próximos avisos personales por ese canal. Esto no elimina mensajes ya recibidos en Telegram ni el historial de tus trámites en SGIAC.",
        ],
      },
      {
        titulo: "Conservación y solicitudes sobre tus datos",
        contenido: [
          "Cerrar sesión o borrar las cookies no elimina tu cuenta ni los registros de actividad. La información de la cuenta permanece almacenada; no se establece aquí un plazo de eliminación automática. Consulta con el personal responsable los plazos de conservación de tu información académica y de atención.",
          "Puedes solicitar la consulta o corrección de tus datos y pedir información sobre la posibilidad de eliminar tu cuenta. Presenta la solicitud ante Secretaría o Kardex, indicando qué información deseas revisar. El personal deberá comprobar tu identidad y evaluar si existen trámites pendientes o registros académicos que deban conservarse. No incluyas tu contraseña ni códigos de verificación.",
        ],
      },
    ],
  },
  seguridad: {
    titulo: "Política de seguridad y uso responsable",
    descripcion: "Medidas de protección del acceso y reglas para utilizar el sistema.",
    secciones: [
      {
        titulo: "Protección del acceso",
        contenido: [
          "SGIAC restringe las funciones privadas mediante autenticación y permisos por rol. El acceso incluye un CAPTCHA y límites de solicitudes para reducir intentos automatizados. Las sesiones tienen vencimiento y el sistema registra eventos de autenticación para su revisión.",
          "La verificación en dos pasos es opcional. Puedes activarla desde tu cuenta o, si eres administrador, desde Configuración. Cuando está activa, el inicio de sesión requiere además un código enviado a tu correo. Protege también el acceso a ese correo.",
        ],
      },
      {
        titulo: "Cuidado de tu cuenta",
        contenido: [
          "Utiliza una contraseña exclusiva para SGIAC, de al menos ocho caracteres, con mayúsculas, minúsculas y números. No compartas tu cuenta, contraseña o códigos de verificación. El personal de atención no necesita que le entregues esos secretos.",
          "Comprueba que estás en la dirección institucional correcta y que la conexión utiliza HTTPS antes de ingresar datos. Cierra sesión al terminar, especialmente en equipos compartidos, y evita guardar la contraseña en equipos ajenos.",
        ],
      },
      {
        titulo: "Uso permitido y confidencialidad",
        contenido: [
          "Utiliza el sistema para consultas y gestiones académicas autorizadas y proporciona información veraz. No suplantes a otras personas, intentes eludir los permisos, alteres datos sin autorización ni realices acciones que interrumpan el servicio.",
          "El personal con acceso administrativo debe consultar y utilizar los datos únicamente para sus funciones. No debe divulgar información personal ni compartir reportes con personas que no estén autorizadas para recibirlos.",
        ],
      },
      {
        titulo: "Comunicación de incidentes",
        contenido: [
          "Si observas un acceso que no reconoces, información expuesta o un comportamiento sospechoso, comunícalo al personal responsable de SGIAC a través de Secretaría o Kardex. Indica cuándo ocurrió y describe lo observado sin enviar contraseñas, códigos ni información personal de terceros.",
          "Si sospechas que tu contraseña se ha expuesto, cámbiala y solicita asistencia. Evita seguir explorando datos ajenos o reproducir acciones que puedan afectar a otras personas.",
        ],
      },
    ],
  },
  cookies: {
    titulo: "Política de cookies",
    descripcion: "Información sobre las cookies que permiten mantener tu sesión.",
    secciones: [
      {
        titulo: "Qué cookies utiliza SGIAC",
        contenido: [
          "Las cookies son pequeños datos que el navegador guarda y envía al servicio. SGIAC utiliza dos cookies de autenticación al iniciar sesión. El portal no incorpora cookies de publicidad ni de analítica.",
        ],
      },
      {
        titulo: "Duración y renovación",
        contenido: [
          "Las duraciones indicadas se cuentan desde que se emite o renueva cada cookie. La renovación de la sesión vuelve a establecer esos plazos. El cierre de sesión elimina ambas cookies del navegador.",
          "Estas cookies no contienen tu contraseña. Están configuradas para que los scripts de la página no puedan leerlas directamente.",
        ],
      },
      {
        titulo: "Cómo gestionarlas",
        contenido: [
          "Puedes eliminar o bloquear las cookies desde la configuración de privacidad de tu navegador. Si bloqueas las cookies de autenticación, el inicio de sesión y su renovación pueden dejar de funcionar. Puedes seguir consultando las páginas públicas sin iniciar sesión.",
          "Eliminar cookies solo afecta a los datos del navegador: no borra tu cuenta ni la información que ya hayas enviado. Para consultas sobre esos datos, revisa la política de privacidad.",
        ],
      },
    ],
  },
};

export default function PoliticasPage({ politica }: { politica: Politica }) {
  const contenido = POLITICAS[politica];
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${contenido.titulo} | SGIAC`;
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    return () => { document.title = previousTitle; };
  }, [contenido.titulo]);

  return (
    <article className="container-public max-w-3xl py-10 sm:py-14">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-extrabold text-slate-800">
        {contenido.titulo}
      </h1>
      <p className="mt-3 text-slate-600">{contenido.descripcion}</p>
      <p className="mt-2 text-sm text-slate-500">
        Última actualización: <time dateTime="2026-09-22">22 de septiembre de 2026</time>.
      </p>

      <nav aria-label="Políticas del sistema" className="my-8 flex flex-wrap gap-3">
        {(["privacidad", "seguridad", "cookies"] as const).map((item) => (
          <NavLink key={item} to={`/${item}`} className={({ isActive }) =>
            `rounded-lg border px-4 py-2 text-sm font-medium ${isActive
              ? "border-primary-700 bg-primary-50 text-primary-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`
          }>
            {item === "privacidad" ? "Privacidad" : item === "seguridad" ? "Seguridad" : "Cookies"}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-6">
        {contenido.secciones.map((seccion, index) => (
          <section key={seccion.titulo} aria-labelledby={`politica-seccion-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 id={`politica-seccion-${index}`} className="text-lg font-bold text-slate-800">{seccion.titulo}</h2>
            {seccion.contenido.map((parrafo) => (
              <p key={parrafo} className="mt-3 text-sm leading-7 text-slate-600">{parrafo}</p>
            ))}
            {politica === "cookies" && index === 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <caption className="sr-only">Cookies de autenticación y duración en el navegador</caption>
                  <thead className="bg-slate-50 text-slate-800">
                    <tr>
                      <th scope="col" className="p-3">Cookie</th>
                      <th scope="col" className="p-3">Finalidad</th>
                      <th scope="col" className="p-3">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <th scope="row" className="p-3 font-medium">accessToken</th>
                      <td className="p-3">Identificar la sesión en las solicitudes al sistema.</td>
                      <td className="p-3">15 minutos</td>
                    </tr>
                    <tr>
                      <th scope="row" className="p-3 font-medium">refreshToken</th>
                      <td className="p-3">Renovar la sesión sin volver a introducir la contraseña.</td>
                      <td className="p-3">7 días</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm leading-6 text-slate-600">
        Las actualizaciones de estas políticas se publicarán en estas páginas con su fecha de revisión.
        Para orientación, consulta la <Link to="/informacion" className="font-medium text-primary-700 underline underline-offset-2">información institucional</Link>.
      </p>
      <Link to="/" className="btn-secondary mt-6">Volver al inicio</Link>
    </article>
  );
}
