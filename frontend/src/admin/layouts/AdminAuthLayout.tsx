import { Outlet } from "react-router-dom";

// Layout completamente independiente del portal publico, usado
// unicamente para /admin/login. No incluye Header ni Footer del
// sitio publico ni el sidebar del panel.
export function AdminAuthLayout() {
  return (
    <div className="admin-theme flex min-h-screen items-center justify-center !bg-[#111c32] p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center border border-white/20 bg-white/10 text-2xl font-bold text-white">
            S
          </div>
          <p className="text-xl font-bold text-white">SGIAC</p>
          <p className="text-sm text-slate-400">Panel administrativo</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
