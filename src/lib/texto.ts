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
  // Las "palabras" que eran solo puntos ("...") se ignoran ("juan ." busca "juan"). Si todas
  // eran así, no hay nada que buscar: no coincide con nadie (en vez de mostrar a todos).
  const utiles = palabras.filter((p) => p !== "");
  if (utiles.length === 0) return false;
  const pajar = normalizarBusqueda(campos.filter(Boolean).join(" "));
  return utiles.every((p) => pajar.includes(p));
}

export function soloDigitos(texto: string | number | null | undefined): string {
  return String(texto ?? "").replace(/\D/g, "");
}

export type ResultadoDni = { ok: true; dni: string | null } | { ok: false; motivo: string };

/** Formatos aceptados: "30123456", "30.123.456", "30 123 456" y "30123456.0" (así lo exporta Excel). */
const DNI_SOLO_DIGITOS = /^\d+$/;
const DNI_CON_PUNTOS = /^\d{1,3}(\.\d{3})+$/;
const DNI_CON_ESPACIOS = /^\d{1,3}( \d{3})+$/;
const DNI_DECIMAL_EXCEL = /^(\d+)\.0+$/;

/**
 * DNI sin puntos ni espacios. Vacío => null (es opcional).
 * Se aceptan entre 6 y 9 dígitos (DNI viejos, nuevos y algunos extranjeros).
 * La puntuación tiene que estar bien puesta: "3.0.1.2.3.4.5" o "30..123" no son válidos.
 */
export function normalizarDni(entrada: string | number | null | undefined): ResultadoDni {
  const t = limpiarEspacios(String(entrada ?? ""));
  if (t === "") return { ok: true, dni: null };
  let digitos: string;
  // El orden importa: "30.100.000" son miles (no el decimal ".000" de Excel).
  if (DNI_SOLO_DIGITOS.test(t)) digitos = t;
  else if (DNI_CON_PUNTOS.test(t) || DNI_CON_ESPACIOS.test(t)) digitos = soloDigitos(t);
  else if (DNI_DECIMAL_EXCEL.test(t)) digitos = t.replace(DNI_DECIMAL_EXCEL, "$1");
  else if (soloDigitos(t) === "") return { ok: false, motivo: "El DNI no tiene números" };
  else return { ok: false, motivo: "Escribí el DNI solo con números (ej. 30123456) o con puntos (30.123.456)" };
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

/**
 * Texto seguro para una celda de Excel: si empieza con = + - @ (o tab o retorno), Excel podría tomarlo
 * como fórmula si alguien edita la celda. Se antepone un apóstrofo, que Excel no muestra.
 */
export function neutralizarFormula(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}
