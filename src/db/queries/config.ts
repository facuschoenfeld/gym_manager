/** Lectura y escritura de la tabla `config` (clave/valor), validada con Zod. */
import { z } from "zod";
import { consultar, ejecutarLote } from "../client";
import { CLAVE_LOGO_BD } from "./logo";

const entero = (min: number, max: number, porDefecto: number) =>
  z.coerce.number().int().min(min).max(max).catch(porDefecto);

export const esquemaConfig = z.object({
  nombre_gimnasio: z.string().catch("Mi Gimnasio"),
  dias_por_vencer: entero(0, 60, 5),
  dias_gracia: entero(0, 60, 0),
  regla_vencimiento: z
    .enum(["desde_vencimiento_anterior", "desde_fecha_pago"])
    .catch("desde_vencimiento_anterior"),
  plantilla_aviso: z.string().catch(""),
  codigo_area: z.string().catch(""),
  carpeta_respaldos: z.string().catch(""),
  respaldos_a_conservar: entero(1, 365, 14),
  ultimo_respaldo: z.string().catch(""),
  mapeo_importacion: z.string().catch(""),
});

export type Config = z.infer<typeof esquemaConfig>;
export type ClaveConfig = keyof Config;

export async function leerConfig(): Promise<Config> {
  // El logo (data URL, puede pesar cientos de KB) no se lee acá: tiene su propia consulta (logo.ts).
  const filas = await consultar<{ clave: string; valor: string | null }>(
    "SELECT clave, valor FROM config WHERE clave <> $1",
    [CLAVE_LOGO_BD],
  );
  const crudo = Object.fromEntries(filas.map((f) => [f.clave, f.valor ?? ""]));
  return esquemaConfig.parse(crudo);
}

/** Guarda varias claves en UNA transacción: o se guardan todas o ninguna. */
export async function guardarConfig(cambios: Partial<Config>): Promise<void> {
  await ejecutarLote(
    Object.entries(cambios).map(([clave, valor]) => ({
      sql: "INSERT INTO config (clave, valor) VALUES ($1, $2) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      parametros: [clave, String(valor)],
    })),
  );
}
