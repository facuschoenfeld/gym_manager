/**
 * Saludo según la hora local del reloj del sistema, y texto de la fecha de hoy para la pantalla de Inicio.
 * Todo puro: la hora se recibe por parámetro (`ahora`) para poder testearla.
 */
import { formatearFecha, hoyISO } from "./fechas";

export type Saludo = "Buen día" | "Buenas tardes" | "Buenas noches";

/** Inicio de cada franja (hora local, desde esa hora inclusive). Sin huecos: cada hora cae en una franja. */
export const HORA_INICIO_TARDE = 13;
export const HORA_INICIO_NOCHE = 20;
export const HORA_INICIO_DIA = 6;

export function saludoSegunHora(ahora: Date = new Date()): Saludo {
  const hora = ahora.getHours();
  if (hora >= HORA_INICIO_NOCHE || hora < HORA_INICIO_DIA) return "Buenas noches";
  if (hora >= HORA_INICIO_TARDE) return "Buenas tardes";
  return "Buen día";
}

/**
 * ¿Cambió lo que muestra el encabezado (el saludo o el día)? Sirve para no re-renderizar en cada
 * tick del reloj: solo se actualiza cuando cambia la franja horaria o la fecha.
 */
export function debeActualizar(previo: Date, nuevo: Date): boolean {
  return saludoSegunHora(previo) !== saludoSegunHora(nuevo) || hoyISO(previo) !== hoyISO(nuevo);
}

/** Ejemplo: "Buen día, hoy es 03/11/2026". */
export function textoSaludo(ahora: Date = new Date()): string {
  return `${saludoSegunHora(ahora)}, hoy es ${formatearFecha(hoyISO(ahora))}`;
}
