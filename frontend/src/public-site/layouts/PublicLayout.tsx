import { Outlet, useLocation } from "react-router-dom";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import "../../styles/portal.css";

export function PublicLayout() {
  const { pathname } = useLocation();
  // Este layout también aloja el acceso y la cuenta del usuario.
  // El portal estudiantil comparte la identidad visual del portal público.
  const portal = pathname.startsWith("/usuario/") || /^\/(?:comunicados(?:\/[^/]+)?|horarios|faq|atencion|informacion|privacidad|seguridad|cookies)?\/?$/.test(pathname);
  return (
    <div className={`flex min-h-screen flex-col${portal ? " public-portal" : ""}`}>
      <Header portal={portal} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer portal={portal} />
    </div>
  );
}
