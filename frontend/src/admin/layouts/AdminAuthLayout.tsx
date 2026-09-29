import { Link, Outlet, useLocation } from "react-router-dom";
import "../../styles/admin-login.css";
import { LoginBackdrop, LoginBrand } from "../../components/LoginBrand";

// Layout completamente independiente del portal publico, usado
// unicamente para /admin/login. No incluye Header ni Footer del
// sitio publico ni el sidebar del panel.
export function AdminAuthLayout() {
  const { pathname } = useLocation();
  const isAdminLogin = pathname === "/admin/login";

  return (
    <div className={`admin-theme flex min-h-screen items-center justify-center p-6${isAdminLogin ? " admin-login-shell" : " !bg-[#102f2c]"}`}>
      {isAdminLogin && <LoginBackdrop />}
      <div className="w-full max-w-md">
        {!isAdminLogin && <div className="admin-auth-brand mb-8 flex flex-col items-center gap-2 text-center">
          <LoginBrand />
          <p className="text-xl font-bold text-white">Kardex</p>
          <p className="text-sm text-slate-400">Panel administrativo</p>
        </div>}
        <Outlet />
        <nav aria-label="Políticas del sistema" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-300">
          <Link to="/privacidad" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Privacidad<span className="sr-only"> (se abre en otra pestaña)</span></Link>
          <Link to="/seguridad" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Seguridad<span className="sr-only"> (se abre en otra pestaña)</span></Link>
          <Link to="/cookies" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">Cookies<span className="sr-only"> (se abre en otra pestaña)</span></Link>
        </nav>
      </div>
    </div>
  );
}
