import { ReactNode, useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { UsuarioSesion } from "../api/types";
import { AdminIcon } from "../admin/components/AdminIcon";
import { AccountAvatar, accountRoleLabel } from "./AccountIdentity";
import { TwoFactorSettings } from "./TwoFactorSettings";
import "../styles/account.css";

export function AccountSettingsLayout({ usuario, student = false, profile, password }: {
  usuario: UsuarioSesion; student?: boolean; profile: ReactNode; password?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const section = params.get("seccion") === "seguridad" ? "seguridad" : "perfil";
  const [twoFactor, setTwoFactor] = useState<boolean | null>(null);
  const id = useId();
  const select = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set("seccion", value); return next; }, { replace: true });
  return <div className={`account-settings${student ? " account-settings--student container-public" : ""}`}>
    <div className="account-settings__heading">
      <div><p className="account-settings__eyebrow">TU ESPACIO PERSONAL</p><h1>{student ? "Mi perfil" : "Configuración"}</h1><p>Tu información y la seguridad de tu cuenta, en un solo lugar.</p></div>
      <Link className="account-settings__back" to={student ? "/usuario/dashboard" : "/admin/dashboard"}>Volver a mi inicio <AdminIcon name="arrow" size={16} /></Link>
    </div>

    <section className="account-settings__hero" aria-label="Resumen de mi cuenta">
      <div className="account-settings__person"><AccountAvatar usuario={usuario} large /><div><span className="account-settings__role">{accountRoleLabel(usuario.roles)}</span><h2>{usuario.nombreCompleto}</h2><p>{usuario.correo}</p></div></div>
      <div className="account-settings__verification"><span className="account-settings__shield"><AdminIcon name="roles" size={25} /></span><div><strong>{usuario.correoVerificado ? "Correo verificado" : "Correo pendiente"}</strong><span>{usuario.correoVerificado ? "Tu identidad está confirmada" : "Confirma tu correo para continuar"}</span></div></div>
    </section>

    <div className="account-settings__tabs" role="tablist" aria-label="Secciones de mi cuenta">
      {([['perfil', 'Mi perfil', 'estudiantes'], ['seguridad', 'Seguridad', 'roles']] as const).map(([value, label, icon], index) =>
        <button key={value} type="button" role="tab" id={`${id}-tab-${value}`} aria-selected={section === value} aria-controls={`${id}-panel-${value}`}
          tabIndex={section === value ? 0 : -1} onClick={() => select(value)} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 'perfil' : event.key === "End" ? 'seguridad' : index === 0 ? 'seguridad' : 'perfil';
            select(next); document.getElementById(`${id}-tab-${next}`)?.focus();
          }}><AdminIcon name={icon} size={19} />{label}{value === 'seguridad' && twoFactor === true && <span className="account-settings__tab-dot" aria-label="Verificación en dos pasos activada" />}</button>)}
    </div>

    <div className="account-settings__grid">
      <div className="account-settings__panels">
        <div role="tabpanel" id={`${id}-panel-perfil`} aria-labelledby={`${id}-tab-perfil`} hidden={section !== 'perfil'} tabIndex={0}>
          <section className="account-settings__card"><div className="account-settings__card-heading"><span className="account-settings__icon"><AdminIcon name="estudiantes" size={21} /></span><div><h2>{student ? "Información personal y académica" : "Información de la cuenta"}</h2><p>Los datos asociados a tu cuenta institucional.</p></div></div>{profile}</section>
        </div>
        <div role="tabpanel" id={`${id}-panel-seguridad`} aria-labelledby={`${id}-tab-seguridad`} hidden={section !== 'seguridad'} tabIndex={0}>
          <TwoFactorSettings onStatusChange={setTwoFactor} />
          {password}
        </div>
      </div>

      <aside className="account-settings__aside" aria-label="Información de seguridad">
        <section className="account-settings__protection"><span className="account-settings__aside-icon"><AdminIcon name="roles" size={24} /></span><h2>Un acceso más seguro</h2><p>Un código enviado a tu correo añade una segunda verificación al iniciar sesión.</p>
          <div className={`account-settings__status${twoFactor === true ? ' is-enabled' : ''}`}><span />{twoFactor === null ? "Estado sin confirmar" : twoFactor ? "Verificación en dos pasos activa" : "Verificación en dos pasos inactiva"}</div>
          {section !== 'seguridad' && <button type="button" onClick={() => { select('seguridad'); document.getElementById(`${id}-tab-seguridad`)?.focus(); }}>Revisar seguridad <AdminIcon name="arrow" size={16} /></button>}
        </section>
        <section className="account-settings__session-note"><AdminIcon name="clock" size={19} /><div><h3>Tu sesión se cuida sola</h3><p>Se cierra tras 3 minutos sin actividad. Te avisaremos antes para que puedas continuar.</p></div></section>
      </aside>
    </div>
  </div>;
}
