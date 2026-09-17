interface AlertMessageProps {
  type: "error" | "success" | "info";
  message: string;
}

const STYLES: Record<AlertMessageProps["type"], string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export function AlertMessage({ type, message }: AlertMessageProps) {
  if (!message) return null;
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${STYLES[type]}`} role="alert">
      {message}
    </div>
  );
}
