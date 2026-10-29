const conectores = new Set(["A", "AL", "DE", "DEL", "EL", "LA", "LOS", "LAS", "LO", "Y", "E", "O", "U", "EN", "PARA", "POR", "CON", "UN", "UNA", "UNOS", "UNAS"]);

export function sugerirIdentificador(nombre: string, ocupados: string[] = []): string {
  if (!nombre.trim()) return "";
  const palabras = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .split(/[^A-Z0-9]+/).filter(p => /^[A-Z]/.test(p) && !conectores.has(p));
  const base = palabras.length > 1 ? palabras.slice(0, 4).map(p => p[0]).join("") : palabras[0]?.slice(0, 3) || "FIC";
  return identificadorDisponible(base, ocupados);
}

export function identificadorDisponible(base: string, ocupados: string[] = []): string {
  if (!base) return "";
  const usados = new Set(ocupados.map(id => id.trim().toUpperCase()));
  let sugerencia = base;
  for (let n = 2; usados.has(sugerencia); n++) sugerencia = `${base.slice(0, 20 - String(n).length)}${n}`;
  return sugerencia;
}
