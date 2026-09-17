// Este archivo re-exporta el middleware de autenticacion global
// para mantener consistencia con la estructura de carpetas
// solicitada (cada modulo expone su propio auth.middleware.ts).
// La logica real vive en src/middlewares/auth.middleware.ts para
// poder ser reutilizada por los futuros modulos (aulas, horarios,
// comunicados, etc.) sin duplicar codigo.
export { requireAuth, requireRole, requireAdmin } from "../../middlewares/auth.middleware";
