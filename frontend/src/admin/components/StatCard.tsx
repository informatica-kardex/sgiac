import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: "primary" | "emerald" | "amber" | "sky";
}
const ACCENTS = {
  primary: "bg-[#d3f7eb] text-[#238878]",
  emerald: "bg-[#e6faf5] text-[#238878]",
  amber: "bg-blue-50 text-blue-700",
  sky: "bg-[#cbf3e9] text-[#1b6f65]",
};
export function StatCard({ label, value, icon, accent = "primary" }: StatCardProps) {
  return <div className="card min-h-[172px] p-5">
    <div className={`grid h-10 w-10 place-items-center ${ACCENTS[accent]}`}>{icon}</div>
    <p className="mt-5 text-3xl font-extrabold tracking-tight text-[#153b36]">{typeof value === "number" ? String(value).padStart(2, "0") : value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-700">{label}</p>
  </div>;
}
