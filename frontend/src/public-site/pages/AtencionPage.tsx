import { Link } from "react-router-dom";
import { useUserAuthStore } from "../../store/userAuthStore";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { TableroAtencion } from "../../components/TableroAtencion";

export default function AtencionPage() {
  const { isAuthenticated, isInitializing } = useUserAuthStore();

  return (
    <div className="container-public py-14">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-extrabold text-slate-800">Atención Kardex</h1>
        <p className="mt-2 text-slate-500">
          Genera tu ficha de atención para realizar tus trámites académicos.
        </p>
      </div>

      <div className="mb-10"><TableroAtencion /></div>
      <div className="grid items-start gap-8 lg:grid-cols-5">
        <section className="card p-6 sm:p-8 lg:col-span-3" aria-labelledby="generar-ficha">
          <span className="student-access-icon mb-4" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Z" />
              <path d="M9 8h6M9 12h6M9 16h4" />
            </svg>
          </span>
          <h2 id="generar-ficha" className="text-2xl font-bold text-slate-800">Generar ficha</h2>
          {isInitializing ? <LoadingSpinner label="Verificando tu sesión..." /> : isAuthenticated ? (
            <>
              <p className="mt-4 leading-7 text-slate-600">
                Ya iniciaste sesión. Ingresa a tus fichas para elegir una jornada con cupos disponibles e indicar el motivo de tu atención.
              </p>
              <Link to="/usuario/fichas?solicitar=1" className="btn-primary mt-6 inline-flex">
                Solicitar mi ficha
              </Link>
            </>
          ) : (
            <>
              <p className="mt-4 leading-7 text-slate-600">
                Para generar una ficha de atención necesitas una cuenta de estudiante.
                Si todavía no tienes una, crea tu cuenta y confirma tu correo electrónico.
                Si ya estás registrado, inicia sesión para continuar.
              </p>
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-600">
                <li>Crea tu cuenta con tus datos de estudiante y verifica tu correo.</li>
                <li>Inicia sesión para acceder a tus fichas de atención.</li>
                <li>Elige tu trámite y una jornada disponible. La ficha se genera con los datos de tu cuenta.</li>
              </ol>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/login" state={{ generarFicha: true }} className="btn-primary">
                  Iniciar sesión para generar ficha
                </Link>
                <Link to="/registro" className="btn-secondary">
                  Crear cuenta
                </Link>
              </div>
            </>
          )}
          <p className="mt-5 text-sm text-slate-500">
            La ficha quedará vinculada a tu cuenta para que puedas consultar su estado. La disponibilidad depende de los cupos de cada jornada.
          </p>
        </section>

        <aside className="card space-y-5 p-6 lg:col-span-2" aria-label="Información de atención">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Horario</p>
            <p className="text-slate-700">Lunes a viernes, 8:00 - 16:00</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Ubicación</p>
            <p className="text-slate-700">Bloque C, planta baja — Carrera de Informática</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Contacto</p>
            <p className="break-words text-slate-700">kardex.informatica@universidad.edu.bo</p>
            <p className="text-slate-700">Tel. (591) 2-2xx-xxxx</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
