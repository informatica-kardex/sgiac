import { Routes, Route, Navigate } from "react-router-dom";

// Portal publico
import { PublicLayout } from "../public-site/layouts/PublicLayout";
import HomePage from "../public-site/pages/HomePage";
import ComunicadosPage from "../public-site/pages/ComunicadosPage";
import ComunicadoDetallePage from "../public-site/pages/ComunicadoDetallePage";
import HorariosPage from "../public-site/pages/HorariosPage";
import FaqPage from "../public-site/pages/FaqPage";
import AtencionPage from "../public-site/pages/AtencionPage";
import PantallaAtencionPage from "../public-site/pages/PantallaAtencionPage";
import InformacionPage from "../public-site/pages/InformacionPage";
import PoliticasPage from "../public-site/pages/PoliticasPage";

// Portal institucional (usuario normal, login voluntario)
import RegisterPage from "../user/pages/RegisterPage";
import LoginPage from "../user/pages/LoginPage";
import RecoverPasswordPage from "../user/pages/RecoverPasswordPage";
import UserDashboardPage from "../user/pages/DashboardPage";
import ProfilePage from "../user/pages/ProfilePage";
import StudentFichasPage from "../user/pages/FichasPage";
import SchedulePlannerPage from "../user/pages/SchedulePlannerPage";
import { UserGuestRoute, UserProtectedRoute } from "../auth/UserProtectedRoute";

// Panel administrativo
import { AdminAuthLayout } from "../admin/layouts/AdminAuthLayout";
import { AdminLayout } from "../admin/layouts/AdminLayout";
import AdminLoginPage from "../admin/pages/AdminLoginPage";
import ChangePasswordForcedPage from "../admin/pages/ChangePasswordForcedPage";
import DashboardPage from "../admin/pages/DashboardPage";
import DocentesPage from "../admin/pages/DocentesPage";
import MateriasPage from "../admin/pages/MateriasPage";
import AulasPage from "../admin/pages/AulasPage";
import AdminHorariosPage from "../admin/pages/HorariosPage";
import VerHorariosPage from "../admin/pages/VerHorariosPage";
import AdminComunicadosPage from "../admin/pages/ComunicadosPage";
import AdminFaqPage from "../admin/pages/FaqPage";
import FichasPage from "../admin/pages/FichasPage";
import ReportesPage from "../admin/pages/ReportesPage";
import UsuariosPage from "../admin/pages/UsuariosPage";
import AuditPage from "../admin/pages/AuditPage";
import RolesPage from "../admin/pages/RolesPage";
import ConfiguracionPage from "../admin/pages/ConfiguracionPage";

import { AdminGuestRoute, AdminProtectedRoute } from "../auth/AdminProtectedRoute";
import VerifyEmailPage from "../auth/VerifyEmailPage";
import PasswordUpdatedPage from "../admin/pages/PasswordUpdatedPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/atencion/pantalla" element={<PantallaAtencionPage />} />
      {/* ------------------ PORTAL PUBLICO (/) ------------------ */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/comunicados" element={<ComunicadosPage />} />
        <Route path="/comunicados/:id" element={<ComunicadoDetallePage />} />
        <Route path="/horarios" element={<HorariosPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/atencion" element={<AtencionPage />} />
        <Route path="/informacion" element={<InformacionPage />} />
        <Route path="/privacidad" element={<PoliticasPage politica="privacidad" />} />
        <Route path="/seguridad" element={<PoliticasPage politica="seguridad" />} />
        <Route path="/cookies" element={<PoliticasPage politica="cookies" />} />
      </Route>

      {/* ------------------ LOGIN INSTITUCIONAL (/login) ------------------ */}
      {/* Ruta completamente distinta del login administrativo: propio */}
      {/* store, propio hook y propio endpoint /api/auth/login.        */}
      <Route element={<PublicLayout />}>
        <Route element={<UserGuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/recuperar-password" element={<RecoverPasswordPage />} />
          <Route path="/registro" element={<RegisterPage />} />
          <Route path="/register" element={<Navigate to="/registro" replace />} />
        </Route>

        <Route path="/usuario/password-actualizada" element={<div className="mx-auto my-10 max-w-md"><PasswordUpdatedPage admin={false} /></div>} />
        <Route element={<UserProtectedRoute />}>
          <Route path="/usuario/cambiar-password" element={<div className="mx-auto my-10 max-w-md"><ChangePasswordForcedPage admin={false} /></div>} />
          <Route path="/usuario/verificar-correo" element={<VerifyEmailPage />} />
          <Route path="/usuario/dashboard" element={<UserDashboardPage />} />
          <Route path="/usuario/perfil" element={<ProfilePage />} />
          <Route path="/usuario/fichas" element={<StudentFichasPage />} />
          <Route path="/usuario/horarios" element={<HorariosPage />} />
          <Route path="/usuario/arma-tu-horario" element={<SchedulePlannerPage />} />
          <Route path="/usuario/comunicados" element={<ComunicadosPage />} />
          <Route path="/usuario/comunicados/:id" element={<ComunicadoDetallePage />} />
          <Route path="/usuario/faq" element={<FaqPage />} />
          <Route path="/usuario" element={<Navigate to="/usuario/dashboard" replace />} />
        </Route>
      </Route>

      {/* ------------------ LOGIN ADMINISTRATIVO (/admin/login) ------------------ */}
      <Route element={<AdminGuestRoute />}>
        <Route element={<AdminAuthLayout />}>
          <Route path="/admin/login" element={<AdminLoginPage />} />
        </Route>
      </Route>

      {/* La confirmación permanece visible después de cerrar la sesión. */}
      <Route element={<AdminAuthLayout />}>
        <Route path="/admin/password-actualizada" element={<PasswordUpdatedPage />} />
      </Route>

      {/* ------------------ PANEL ADMINISTRATIVO (/admin/*) ------------------ */}
      <Route element={<AdminProtectedRoute />}>
        {/* Cambio de contrasena obligatorio: layout minimal, sin sidebar */}
        <Route element={<AdminAuthLayout />}>
          <Route path="/admin/cambiar-password" element={<ChangePasswordForcedPage />} />
          <Route path="/admin/verificar-correo" element={<VerifyEmailPage admin />} />
        </Route>

        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/docentes" element={<DocentesPage />} />
          <Route path="/admin/materias" element={<MateriasPage />} />
          <Route path="/admin/aulas" element={<AulasPage />} />
          <Route path="/admin/horarios" element={<AdminHorariosPage />} />
          <Route path="/admin/ver-horarios" element={<VerHorariosPage />} />
          <Route path="/admin/comunicados" element={<AdminComunicadosPage />} />
          <Route path="/admin/faq" element={<AdminFaqPage />} />
          <Route path="/admin/fichas" element={<FichasPage />} />
          <Route path="/admin/reportes" element={<ReportesPage />} />
          <Route path="/admin/usuarios" element={<Navigate to="/admin/subadministradores" replace />} />
          <Route path="/admin/subadministradores" element={<UsuariosPage key="subadministradores" tipo="subadministradores" />} />
          <Route path="/admin/estudiantes" element={<UsuariosPage key="estudiantes" tipo="estudiantes" />} />
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
