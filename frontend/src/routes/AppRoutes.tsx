import { Routes, Route, Navigate } from "react-router-dom";

// Portal publico
import { PublicLayout } from "../public-site/layouts/PublicLayout";
import HomePage from "../public-site/pages/HomePage";
import ComunicadosPage from "../public-site/pages/ComunicadosPage";
import ComunicadoDetallePage from "../public-site/pages/ComunicadoDetallePage";
import HorariosPage from "../public-site/pages/HorariosPage";
import FaqPage from "../public-site/pages/FaqPage";
import AtencionPage from "../public-site/pages/AtencionPage";
import InformacionPage from "../public-site/pages/InformacionPage";

// Portal institucional (usuario normal, login voluntario)
import RegisterPage from "../user/pages/RegisterPage";
import LoginPage from "../user/pages/LoginPage";
import UserDashboardPage from "../user/pages/DashboardPage";
import { UserGuestRoute, UserProtectedRoute } from "../auth/UserProtectedRoute";

// Panel administrativo
import { AdminAuthLayout } from "../admin/layouts/AdminAuthLayout";
import { AdminLayout } from "../admin/layouts/AdminLayout";
import AdminLoginPage from "../admin/pages/AdminLoginPage";
import ChangePasswordForcedPage from "../admin/pages/ChangePasswordForcedPage";
import DashboardPage from "../admin/pages/DashboardPage";
import AulasPage from "../admin/pages/AulasPage";
import AdminHorariosPage from "../admin/pages/HorariosPage";
import AdminComunicadosPage from "../admin/pages/ComunicadosPage";
import AdminFaqPage from "../admin/pages/FaqPage";
import FichasPage from "../admin/pages/FichasPage";
import ReportesPage from "../admin/pages/ReportesPage";
import UsuariosPage from "../admin/pages/UsuariosPage";
import AuditPage from "../admin/pages/AuditPage";
import RolesPage from "../admin/pages/RolesPage";
import ConfiguracionPage from "../admin/pages/ConfiguracionPage";

import { AdminGuestRoute, AdminProtectedRoute } from "../auth/AdminProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      {/* ------------------ PORTAL PUBLICO (/) ------------------ */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/comunicados" element={<ComunicadosPage />} />
        <Route path="/comunicados/:id" element={<ComunicadoDetallePage />} />
        <Route path="/horarios" element={<HorariosPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/atencion" element={<AtencionPage />} />
        <Route path="/informacion" element={<InformacionPage />} />
      </Route>

      {/* ------------------ LOGIN INSTITUCIONAL (/login) ------------------ */}
      {/* Ruta completamente distinta del login administrativo: propio */}
      {/* store, propio hook y propio endpoint /api/auth/login.        */}
      <Route element={<PublicLayout />}>
        <Route element={<UserGuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/register" element={<Navigate to="/registro" replace />} />
        </Route>

        <Route element={<UserProtectedRoute />}>
          <Route path="/usuario/dashboard" element={<UserDashboardPage />} />
        </Route>
      </Route>

      {/* ------------------ LOGIN ADMINISTRATIVO (/admin/login) ------------------ */}
      <Route element={<AdminGuestRoute />}>
        <Route element={<AdminAuthLayout />}>
          <Route path="/admin/login" element={<AdminLoginPage />} />
        </Route>
      </Route>

      {/* ------------------ PANEL ADMINISTRATIVO (/admin/*) ------------------ */}
      <Route element={<AdminProtectedRoute />}>
        {/* Cambio de contrasena obligatorio: layout minimal, sin sidebar */}
        <Route element={<AdminAuthLayout />}>
          <Route path="/admin/cambiar-password" element={<ChangePasswordForcedPage />} />
        </Route>

        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/aulas" element={<AulasPage />} />
          <Route path="/admin/horarios" element={<AdminHorariosPage />} />
          <Route path="/admin/comunicados" element={<AdminComunicadosPage />} />
          <Route path="/admin/faq" element={<AdminFaqPage />} />
          <Route path="/admin/fichas" element={<FichasPage />} />
          <Route path="/admin/reportes" element={<ReportesPage />} />
          <Route path="/admin/usuarios" element={<UsuariosPage />} />
          <Route path="/admin/roles" element={<RolesPage />} />
          <Route path="/admin/auditoria" element={<AuditPage />} />
          <Route path="/admin/configuracion" element={<ConfiguracionPage />} />
        </Route>
      </Route>

      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
