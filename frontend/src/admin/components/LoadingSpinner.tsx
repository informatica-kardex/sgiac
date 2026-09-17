export function LoadingSpinner({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-slate-500">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary-200 border-t-primary-700" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
