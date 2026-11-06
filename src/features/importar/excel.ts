/**
 * Lectura y escritura de archivos Excel para la importación (SheetJS). Se carga con import() dinámico
 * para no pesar en el arranque. La lógica de qué importar está en logica/importar.ts.
 *
 * Los archivos son no confiables: se acotan filas, columnas y largo de texto, y se exige la firma de
 * un .xlsx (un zip). Al exportar, los textos que empiezan con = + - @ se neutralizan (ver texto.ts).
 */
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { WorkBook } from "xlsx";
import { neutralizarFormula } from "@/lib/texto";
import type { FilaImportacion, FilaValidada } from "./logica/importar";

const TIPO_XLSX = { name: "Excel", extensions: ["xlsx"] };

/** Tamaño máximo del archivo elegido. Una planilla de socios pesa muy poco. */
export const MAX_BYTES_ARCHIVO = 5 * 1024 * 1024;
/** Filas de datos que se leen (sin contar el encabezado). El resto se ignora y se avisa. */
export const MAX_FILAS_IMPORTACION = 5000;
/** Columnas que se leen. Más que esto no es una planilla de socios. */
export const MAX_COLUMNAS_IMPORTACION = 40;
/** Largo máximo de un texto de celda. Un nombre o un email no pasa de acá. */
export const MAX_LARGO_TEXTO_CELDA = 200;

/** Los .xlsx son zip: empiezan con "PK". Otros formatos que SheetJS entiende quedan afuera. */
function esZip(buffer: ArrayBuffer): boolean {
  const b = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return b[0] === 0x50 && b[1] === 0x4b;
}

export interface LecturaHoja {
  encabezados: string[];
  filas: FilaImportacion[];
  /** true si el archivo tenía más filas que MAX_FILAS_IMPORTACION y se leyeron solo las primeras. */
  recortado: boolean;
}

/** Primera hoja del libro: encabezados (fila 1) y filas con datos (las vacías se descartan). */
export async function leerPrimeraHoja(buffer: ArrayBuffer): Promise<LecturaHoja> {
  if (!esZip(buffer)) throw new Error("El archivo no es un Excel (.xlsx) válido.");
  const XLSX = await import("xlsx");
  // sheetRows limita cuánto se parsea: un rango inflado no puede colgar la app.
  const libro = XLSX.read(buffer, { type: "array", cellDates: true, sheetRows: MAX_FILAS_IMPORTACION + 1 });
  const nombreHoja = libro.SheetNames[0];
  const hoja = nombreHoja ? libro.Sheets[nombreHoja] : undefined;
  if (!hoja) throw new Error("El archivo no tiene ninguna hoja con datos.");

  const matriz = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, blankrows: true, defval: null, raw: true });
  const [encabezadosCrudos = [], ...cuerpo] = matriz;
  const encabezados = encabezadosCrudos.map((c) => (c === null || c === undefined ? "" : String(c).trim()));
  // Columnas con encabezado vacío al final no cuentan (suelen venir del formato de la hoja).
  const ultimo = encabezados.reduce((acc, h, i) => (h !== "" ? i : acc), -1);
  if (ultimo + 1 > MAX_COLUMNAS_IMPORTACION) {
    throw new Error(`El archivo tiene más de ${MAX_COLUMNAS_IMPORTACION} columnas. Dejá solo las de los socios.`);
  }
  const filas: FilaImportacion[] = [];
  cuerpo.forEach((celdas, i) => {
    const limpias = celdas.map((c) => (typeof c === "string" ? c.slice(0, MAX_LARGO_TEXTO_CELDA) : c));
    const vacia = limpias.every((c) => c === null || c === undefined || (typeof c === "string" && c.trim() === ""));
    if (!vacia) filas.push({ numero: i + 2, celdas: limpias });
  });
  return {
    encabezados: encabezados.slice(0, ultimo + 1),
    filas,
    recortado: cuerpo.length >= MAX_FILAS_IMPORTACION,
  };
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
  const aoa: unknown[][] = [["Fila", ...encabezados, "Motivo"]];
  for (const r of rechazadas) {
    aoa.push([r.numero, ...r.celdas, r.errores.join("; ")]);
  }
  return hojaUnica("Rechazados", aoa);
}

/** Pide al usuario dónde guardar y escribe el archivo. Devuelve false si canceló. */
export async function guardarArchivo(bytes: Uint8Array, nombreSugerido: string): Promise<boolean> {
  const ruta = await save({ defaultPath: nombreSugerido, filters: [TIPO_XLSX] });
  if (!ruta) return false;
  await writeFile(ruta, bytes);
  return true;
}

/** Una hoja con filas (la primera fila son los encabezados). Sirve para exportar listados. */
export async function generarHojaExcel(nombreHoja: string, aoa: string[][]): Promise<Uint8Array> {
  return hojaUnica(nombreHoja, aoa);
}

/** Arma un libro con una sola hoja. Todo texto pasa por neutralizarFormula antes de escribirse. */
async function hojaUnica(nombreHoja: string, aoa: unknown[][]): Promise<Uint8Array> {
  const XLSX = await import("xlsx");
  const seguras = aoa.map((fila) => fila.map((celda) => neutralizarFormula(celda)));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(seguras), nombreHoja);
  return aBytes(libro);
}
