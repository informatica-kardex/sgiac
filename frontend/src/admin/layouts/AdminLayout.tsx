import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "../components/AdminSidebar";
import { AdminNavbar } from "../components/AdminNavbar";

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <div className="admin-theme min-h-screen">
    <AdminSidebar open={open} onClose={() => setOpen(false)} />
    <div className="flex min-h-screen min-w-0 flex-col lg:pl-[258px]">
      <AdminNavbar open={open} onMenu={() => setOpen(true)} />
      <main className="min-w-0 flex-1 p-5 sm:p-8"><Outlet /></main>
      <footer className="flex justify-between gap-4 border-t border-slate-200 px-5 py-4 text-[10px] text-slate-400 sm:px-8"><span>SGIAC v1.0</span><span>Carrera de Informática</span></footer>
    </div>
  </div>;
}
