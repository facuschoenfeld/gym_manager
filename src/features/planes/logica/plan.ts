/** Planes: tipos y validación del formulario (lógica pura). */
import { z } from "zod";
import { parsearPesos } from "@/lib/dinero";
import type { Periodo } from "@/lib/fechas";

export interface Plan {
  id: number;
  nombre: string;
  periodo: Periodo;
  cantidad: number;
  /** Centavos. */
  monto: number;
  activo: boolean;
}

export const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Día" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
];

/** Datos del formulario tal como los escribe el usuario (todo texto). */
export interface FormularioPlan {
  nombre: string;
  periodo: Periodo;
  cantidad: string;
  monto: string;
}

/** $ 100.000.000: muy por encima de cualquier cuota, y lejos del límite de precisión de los números. */
export const PRECIO_MAXIMO_CENTAVOS = 10_000_000_000;

export const esquemaPlan = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribí un nombre para el plan")
    .max(60, "El nombre es demasiado largo (máximo 60 caracteres)"),
  periodo: z.enum(["dia", "semana", "mes"], { message: "Elegí si el plan es por día, semana o mes" }),
  cantidad: z
    .string()
    .trim()
    .regex(/^\d+$/, "Escribí un número entero, por ejemplo 1")
    .transform(Number)
    .pipe(z.number().int().min(1, "Tiene que ser al menos 1").max(36, "Como máximo 36")),
  monto: z.string().transform((texto, ctx) => {
    const centavos = parsearPesos(texto);
    if (centavos === null) {
      ctx.addIssue({ code: "custom", message: "Escribí un precio válido, por ejemplo 25000 o 25.000,50" });
      return z.NEVER;
    }
    return centavos;
  }).pipe(z.number().int().max(PRECIO_MAXIMO_CENTAVOS, "El precio es demasiado alto (máximo $ 100.000.000)")),
});

export type DatosPlan = z.output<typeof esquemaPlan>;

/** ¿Ya existe otro plan con el mismo nombre (sin importar mayúsculas ni acentos)? */
export function nombreDePlanRepetido(nombre: string, planes: Plan[], idActual?: number): boolean {
  const clave = normalizar(nombre);
  return planes.some((p) => p.id !== idActual && normalizar(p.nombre) === clave);
}

function normalizar(t: string): string {
  return t.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-AR");
}

/** Planes que se pueden elegir para un socio: los activos y, si el socio tiene uno inactivo, también ese. */
export function planesElegibles(planes: Plan[], planActualId: number | null): Plan[] {
  return planes.filter((p) => p.activo || p.id === planActualId);
}
