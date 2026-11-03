/** Normalización de textos: nombres, búsqueda y DNI. */

/** Quita espacios sobrantes (incluye espacios duros y tabs). */
export function limpiarEspacios(texto: string | null | undefined): string {
  return String(texto ?? "")
    .replace(/\s+/g, " ") // \s incluye el espacio duro (U+00A0) que suele venir de Excel
    .trim();
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "di", "van", "von"]);

function capitalizarPalabra(p: string): string {
  // Respeta guiones y apóstrofos: "maría-josé" -> "María-José", "o'connor" -> "O'Connor"
  return p.replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, letra: string) => sep + letra.toUpperCase());
}

/** "  jUAN   de la  CRUZ " -> "Juan de la Cruz". */
export function capitalizarNombre(texto: string | null | undefined): string {
  const limpio = limpiarEspacios(texto).toLocaleLowerCase("es-AR");
  if (!limpio) return "";
  return limpio
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : capitalizarPalabra(p)))
    .join(" ");
}

/** Para comparar y buscar: minúsculas, sin acentos ni espacios dobles. "Peña  José" -> "pena jose". */
export function normalizarBusqueda(texto: string | null | undefined): string {
  return limpiarEspacios(texto)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-AR");
}

/** ¿Todas las palabras de la búsqueda aparecen en alguno de los campos? */
export function coincideBusqueda(consulta: string, ...campos: (string | null | undefined)[]): boolean {
  const palabras = normalizarBusqueda(consulta)
    .split(" ")
    .filter(Boolean)
    // "12.345.678" se busca como "12345678" (el DNI se guarda sin puntos)
    .map((p) => (/^[\d.]+$/.test(p) ? p.replace(/\./g, "") : p));
  if (palabras.length === 0) return true;
  const pajar = normalizarBusqueda(campos.filter(Boolean).join(" "));
  return palabras.every((p) => pajar.includes(p));
}

export function soloDigitos(texto: string | number | null | undefined): string {
  return String(texto ?? "").replace(/\D/g, "");
}

export type ResultadoDni = { ok: true; dni: string | null } | { ok: false; motivo: string };

/**
 * DNI sin puntos ni espacios. Vacío => null (es opcional).
 * Se aceptan entre 6 y 9 dígitos (DNI viejos, nuevos y algunos extranjeros).
 * Excel a veces lo trae como número (12345678) o con decimales ("12345678.0").
 */
export function normalizarDni(entrada: string | number | null | undefined): ResultadoDni {
  let t = limpiarEspacios(String(entrada ?? ""));
  if (t === "") return { ok: true, dni: null };
  t = t.replace(/\.0+$/, "");
  const digitos = soloDigitos(t);
  if (digitos.length === 0) return { ok: false, motivo: "El DNI no tiene números" };
  // Los ceros a la izquierda no cuentan: "0000001" no es un DNI válido.
  const d = digitos.replace(/^0+/, "");
  if (d.length < 6 || d.length > 9) return { ok: false, motivo: "El DNI debe tener entre 6 y 9 dígitos" };
  return { ok: true, dni: d };
}

/** "12345678" -> "12.345.678" para mostrar. */
export function formatearDni(dni: string | null | undefined): string {
  if (!dni) return "—";
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Clave de respaldo para detectar duplicados sin DNI: "garcia|juan". */
export function claveNombre(nombre: string | null | undefined, apellido: string | null | undefined): string {
  return `${normalizarBusqueda(apellido)}|${normalizarBusqueda(nombre)}`;
}
