export function nombreDocente(d: { nombre_completo: string; grado_academico?: string | null }) {
  const nombre = d.nombre_completo.trim(), grado = d.grado_academico?.trim();
  if (!grado) return nombre;
  const normal = (s: string) => s.toLowerCase().replace(/[.\s]/g, '');
  // Compatibilidad con nombres antiguos que ya incluyen su abreviatura.
  const prefix = nombre.split(/\s+/)[0];
  return normal(prefix) === normal(grado) ? nombre : `${grado} ${nombre}`;
}
