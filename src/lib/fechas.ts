/**
 * Utilidades de fechas. Formato de almacenamiento: ISO 'YYYY-MM-DD' (string).
 *
 * IMPORTANTE: todo se calcula en hora LOCAL. Nunca usar `Date#toISOString()`
 * para obtener "hoy": devuelve UTC y en Argentina (UTC-3) el día cambia a las 21:00.
 */
import { addDays, addMonths, addWeeks, differenceInCalendarDays } from "date-fns";

/** Fecha sin hora en formato 'YYYY-MM-DD'. */
export type FechaISO = string;

export type Periodo = "dia" | "semana" | "mes";

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const dos = (n: number) => String(n).padStart(2, "0");

/** Convierte un Date a 'YYYY-MM-DD' usando la fecha local. */
export function aISO(fecha: Date): FechaISO {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Hoy en hora local, como 'YYYY-MM-DD'. `ahora` es inyectable para tests. */
export function hoyISO(ahora: Date = new Date()): FechaISO {
  return aISO(ahora);
}

/** Construye una fecha local validando que exista (rechaza 31/02, 29/02 en año no bisiesto, etc.). */
function crearFechaValida(anio: number, mes: number, dia: number): Date | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const f = new Date(anio, mes - 1, dia);
  if (f.getFullYear() !== anio || f.getMonth() !== mes - 1 || f.getDate() !== dia) return null;
  return f;
}

/** 'YYYY-MM-DD' -> Date local (medianoche). Lanza error si es inválida. */
export function desdeISO(iso: FechaISO): Date {
  const m = RE_ISO.exec(iso);
  const f = m ? crearFechaValida(Number(m[1]), Number(m[2]), Number(m[3])) : null;
  if (!f) throw new Error(`Fecha ISO inválida: "${iso}"`);
  return f;
}

export function esFechaISOValida(valor: string): boolean {
  const m = RE_ISO.exec(valor);
  return !!m && crearFechaValida(Number(m[1]), Number(m[2]), Number(m[3])) !== null;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' para mostrar. */
export function formatearFecha(iso: FechaISO | null | undefined): string {
  if (!iso) return "—";
  const m = RE_ISO.exec(iso.slice(0, 10));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Interpreta una fecha escrita a la argentina: 'dd/mm/yyyy', 'd/m/yy', 'dd-mm-yyyy', 'dd.mm.yyyy'.
 * También acepta ISO 'yyyy-mm-dd'. Años de 2 dígitos: 00-69 => 20xx, 70-99 => 19xx.
 * Devuelve null si el texto no es una fecha real.
 */
export function parsearFechaAR(texto: string): FechaISO | null {
  const t = texto.trim();
  if (esFechaISOValida(t)) return t;
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const textoAnio = m[3] ?? "";
  let anio = Number(textoAnio);
  if (textoAnio.length === 2) anio += anio < 70 ? 2000 : 1900;
  const f = crearFechaValida(anio, Number(m[2]), Number(m[1]));
  return f ? aISO(f) : null;
}

/**
 * Número de serie de Excel -> ISO. Excel cuenta días desde 1899-12-30
 * (incluye el falso 29/02/1900, por eso la base es el 30 y no el 31).
 * La parte decimal (hora) se descarta.
 */
export function desdeSerialExcel(serial: number): FechaISO | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const ms = Math.round((Math.floor(serial) - 25569) * 86_400_000); // 25569 = 1970-01-01
  const f = new Date(ms);
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

/**
 * Suma un período a una fecha. Mes = mes calendario: 15/10 + 1 mes = 15/11;
 * si el día no existe se usa el último del mes (31/01 + 1 mes = 28/02 o 29/02).
 */
export function sumarPeriodo(iso: FechaISO, periodo: Periodo, cantidad = 1): FechaISO {
  const f = desdeISO(iso);
  switch (periodo) {
    case "dia":
      return aISO(addDays(f, cantidad));
    case "semana":
      return aISO(addWeeks(f, cantidad));
    case "mes":
      return aISO(addMonths(f, cantidad));
  }
}

export function sumarDias(iso: FechaISO, dias: number): FechaISO {
  return aISO(addDays(desdeISO(iso), dias));
}

/** Días calendario de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diferenciaDias(desde: FechaISO, hasta: FechaISO): number {
  return differenceInCalendarDays(desdeISO(hasta), desdeISO(desde));
}

/** Primer y último día del mes de la fecha dada (para "ingresos del mes"). */
export function rangoDelMes(iso: FechaISO): { desde: FechaISO; hasta: FechaISO } {
  const f = desdeISO(iso);
  const desde = new Date(f.getFullYear(), f.getMonth(), 1);
  const hasta = new Date(f.getFullYear(), f.getMonth() + 1, 0);
  return { desde: aISO(desde), hasta: aISO(hasta) };
}

const NOMBRES_PERIODO: Record<Periodo, [string, string]> = {
  dia: ["día", "días"],
  semana: ["semana", "semanas"],
  mes: ["mes", "meses"],
};

/** "1 mes", "3 meses", "1 semana"... */
export function describirPeriodo(periodo: Periodo, cantidad: number): string {
  const [singular, plural] = NOMBRES_PERIODO[periodo];
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}
