export function RoomCapacity({ value }: { value?: number | null }) {
  const known = value != null && Number.isInteger(value) && value > 0;
  return <span className="room-capacity mt-1 block text-xs font-normal text-emerald-800">
    Capacidad del aula: <strong>{known ? `${value} ${value === 1 ? 'estudiante' : 'estudiantes'}` : 'Por confirmar'}</strong>
  </span>;
}
