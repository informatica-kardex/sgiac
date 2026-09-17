import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: "primary" | "emerald" | "amber" | "sky";
}
const ACCENTS = {
  primary: "bg-blue-50 text-[#2459a9]",
  emerald: "bg-amber-50 text-amber-700",
  amber: "bg-teal-50 text-teal-700",
  sky: "bg-violet-50 text-violet-700",
};
export function StatCard({ label, value, icon, accent = "primary" }: StatCardProps) {
  return <div className="card min-h-[172px] p-5">
    <div className={`grid h-10 w-10 place-items-center ${ACCENTS[accent]}`}>{icon}</div>
    <p className="mt-5 text-3xl font-extrabold tracking-tight text-[#13213d]">{typeof value === "number" ? String(value).padStart(2, "0") : value}</p>
    <p className="mt-1 text-xs font-semibold text-slate-700">{label}</p>
  </div>;
}
