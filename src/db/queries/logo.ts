/**
 * Logo del gimnasio: se guarda como data URL en la tabla `config`, con claves propias, junto con el
 * fondo de caja que le corresponde (claro u oscuro, según sus colores).
 * No va en esquemaConfig: así no se lee en cada useConfig ni interfiere con el formulario de Configuración.
 */
import { esDataUrlLogoValida, type FondoLogo } from "@/features/configuracion/logica/logo";
import { consultar, ejecutarLote } from "../client";

/** Claves de la tabla config. config.ts las excluye de leerConfig para no cargar la imagen en cada lectura. */
export const CLAVE_LOGO_BD = "logo_gimnasio";
export const CLAVE_LOGO_FONDO_BD = "logo_fondo";

export interface LogoGuardado {
  dataUrl: string;
  fondo: FondoLogo;
}

/** El logo guardado, o null si no hay logo o el valor guardado no es válido (ej. editado a mano). */
export async function leerLogo(): Promise<LogoGuardado | null> {
  const filas = await consultar<{ clave: string; valor: string | null }>(
    "SELECT clave, valor FROM config WHERE clave IN ($1, $2)",
    [CLAVE_LOGO_BD, CLAVE_LOGO_FONDO_BD],
  );
  const valores = new Map(filas.map((f) => [f.clave, f.valor ?? ""]));
  const dataUrl = valores.get(CLAVE_LOGO_BD) ?? "";
  if (dataUrl === "" || !esDataUrlLogoValida(dataUrl)) return null;
  // Si falta el fondo (logo cargado antes de existir esta opción), se usa la caja clara de siempre.
  const fondo: FondoLogo = valores.get(CLAVE_LOGO_FONDO_BD) === "oscuro" ? "oscuro" : "claro";
  return { dataUrl, fondo };
}

/** Guarda el logo y su fondo en una sola transacción. Con null, lo quita (guarda cadenas vacías). */
export async function guardarLogo(logo: LogoGuardado | null): Promise<void> {
  const dataUrl = logo?.dataUrl ?? "";
  if (dataUrl !== "" && !esDataUrlLogoValida(dataUrl)) {
    throw new Error("El logo no tiene un formato válido. Volvé a elegir la imagen.");
  }
  const fondo = logo?.fondo ?? "";
  const upsert = "INSERT INTO config (clave, valor) VALUES ($1, $2) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor";
  await ejecutarLote([
    { sql: upsert, parametros: [CLAVE_LOGO_BD, dataUrl] },
    { sql: upsert, parametros: [CLAVE_LOGO_FONDO_BD, fondo] },
  ]);
}
