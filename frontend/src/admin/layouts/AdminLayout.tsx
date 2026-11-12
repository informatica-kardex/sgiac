import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "../components/AdminSidebar";
import { AdminNavbar } from "../components/AdminNavbar";
import { axiosClient } from "../../api/axiosClient";
import { ApiEnvelope } from "../../api/types";
import { useAdminAuthStore } from "../../store/adminAuthStore";
import { subscribeToUpdates } from "../../services/liveUpdates";

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const usuario = useAdminAuthStore(state => state.usuario);
  const [pending, setPending] = useState<Record<string, number>>({});
  useEffect(() => {
    setPending({});
    if (!usuario) return;
    let controller: AbortController | undefined;
    let active = true;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const { data } = await axiosClient.get<ApiEnvelope<Record<string, number>>>("/notificaciones/pendientes", { signal: request.signal });
        if (active && !request.signal.aborted) setPending(data.data);
      } catch { /* Conserva los contadores y vuelve a intentar al recuperar la conexión. */ }
    };
    void load();
    const unsubscribe = subscribeToUpdates(() => { void load(); });
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => { active = false; controller?.abort(); unsubscribe(); window.clearInterval(timer); };
  }, [usuario]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <div className="admin-theme min-h-screen">
    <AdminSidebar open={open} onClose={() => setOpen(false)} pending={pending} />
    <div className="flex min-h-screen min-w-0 flex-col lg:pl-[258px]">
      <AdminNavbar open={open} onMenu={() => setOpen(true)} pending={pending} />
      <main className="min-w-0 flex-1 p-5 sm:p-8"><Outlet /></main>
      <footer className="flex justify-between gap-4 border-t border-slate-200 px-5 py-4 text-[10px] text-slate-400 sm:px-8"><span>SGIAC v1.0</span><span>Carrera de Informática</span></footer>
    </div>
  </div>;
}
