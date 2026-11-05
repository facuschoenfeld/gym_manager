/** Formulario de configuración general (lógica pura). */
import { z } from "zod";
import type { Config } from "@/db/queries/config";

export interface FormularioConfiguracion {
  nombre_gimnasio: string;
  dias_por_vencer: string;
  dias_gracia: string;
  regla_vencimiento: Config["regla_vencimiento"];
  codigo_area: string;
  plantilla_aviso: string;
}

const dias = (campo: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `Escribí la cantidad de ${campo} como un número entero (0 o más)`)
    .transform(Number)
    .pipe(z.number().int().min(0).max(60, "Como máximo 60 días"));

export const esquemaConfiguracion = z.object({
  nombre_gimnasio: z
    .string()
    .trim()
    .min(1, "Escribí el nombre del gimnasio")
    .max(80, "El nombre es demasiado largo (máximo 80 caracteres)"),
  dias_por_vencer: dias("días"),
  dias_gracia: dias("días de gracia"),
  regla_vencimiento: z.enum(["desde_vencimiento_anterior", "desde_fecha_pago"]),
  codigo_area: z
    .string()
    .transform((t) => t.replace(/\D/g, "").replace(/^0+/, ""))
    .pipe(
      z
        .string()
        .regex(/^(\d{2,4})?$/, "El código de área tiene entre 2 y 4 dígitos, sin el 0 (ej. 3482)"),
    ),
  // Vacía = se usa el texto por defecto (ver PLANTILLA_AVISO_POR_DEFECTO).
  plantilla_aviso: z.string().trim().max(600, "La plantilla es demasiado larga (máximo 600 caracteres)"),
});

export type DatosConfiguracion = z.output<typeof esquemaConfiguracion>;

export function configAFormulario(c: Config): FormularioConfiguracion {
  return {
    nombre_gimnasio: c.nombre_gimnasio,
    dias_por_vencer: String(c.dias_por_vencer),
    dias_gracia: String(c.dias_gracia),
    regla_vencimiento: c.regla_vencimiento,
    codigo_area: c.codigo_area,
    plantilla_aviso: c.plantilla_aviso,
  };
}
