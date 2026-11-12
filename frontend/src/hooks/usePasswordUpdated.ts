import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { clearSession } from "../auth/session";

export function usePasswordUpdated(admin = true) {
  const navigate = useNavigate();
  return () => {
    // Primero desmontar las rutas protegidas: cerrar la sesión dentro de ellas
    // puede disparar su redirección al login y ocultar la confirmación.
    flushSync(() => navigate(admin ? "/admin/password-actualizada" : "/usuario/password-actualizada", { replace: true }));
    clearSession();
  };
}
