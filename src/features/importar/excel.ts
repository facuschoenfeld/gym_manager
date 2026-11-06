/**
 * Lectura y escritura de archivos Excel para la importación (SheetJS). Se carga con import() dinámico
 * para no pesar en el arranque. La lógica de qué importar está en logica/importar.ts.
 */
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { WorkBook } from "xlsx";
import type { FilaImportacion, FilaValidada } from "./logica/importar";

const TIPO_XLSX = { name: "Excel", extensions: ["xlsx"] };

/** Primera hoja del libro: encabezados (fila 1) y filas con datos (las vacías se descartan). */
export async function leerPrimeraHoja(
  buffer: ArrayBuffer,
): Promise<{ encabezados: string[]; filas: FilaImportacion[] }> {
  const XLSX = await import("xlsx");
  const libro = XLSX.read(buffer, { type: "array", cellDates: true });
  const nombreHoja = libro.SheetNames[0];
  const hoja = nombreHoja ? libro.Sheets[nombreHoja] : undefined;
  if (!hoja) throw new Error("El archivo no tiene ninguna hoja con datos.");

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, blankrows: true, defval: null, raw: true });
  const [encabezadosCrudos = [], ...cuerpo] = matriz;
  const encabezados = encabezadosCrudos.map((c) => (c === null || c === undefined ? "" : String(c).trim()));
  const filas: FilaImportacion[] = [];
  cuerpo.forEach((celdas, i) => {
    const vacia = celdas.every((c) => c === null || c === undefined || (typeof c === "string" && c.trim() === ""));
    if (!vacia) filas.push({ numero: i + 2, celdas });
  });
  return { encabezados, filas };
}

async function aBytes(libro: WorkBook): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const bytes = XLSX.write(libro, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Uint8Array(bytes);
}

/** Plantilla de ejemplo con los encabezados que se reconocen y una fila de muestra. */
export async function generarPlantilla(): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const hoja = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Apellido", "DNI", "Teléfono", "Email", "Plan", "Último pago", "Vencimiento", "Monto"],
    ["Juan", "Pérez", "30.123.456", "351 15 123 4567", "juan@ejemplo.com", "Mensual", "05/10/2026", "05/11/2026", "15000"],
  ]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Socios");
  return aBytes(libro);
}

/** Filas con error, con el motivo en la última columna, para corregirlas y volver a importarlas. */
export async function generarRechazados(encabezados: string[], rechazadas: FilaValidada[]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const aoa: unknown[][] = [["Fila", ...encabezados, "Motivo"]];
  for (const r of rechazadas) {
    aoa.push([r.numero, ...r.celdas, r.errores.join("; ")]);
  }
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(aoa), "Rechazados");
  return aBytes(libro);
}

/** Pide al usuario dónde guardar y escribe el archivo. Devuelve false si canceló. */
export async function guardarArchivo(bytes: Uint8Array, nombreSugerido: string): Promise<boolean> {
  const ruta = await save({ defaultPath: nombreSugerido, filters: [TIPO_XLSX] });
  if (!ruta) return false;
  await writeFile(ruta, bytes);
  return true;
}
