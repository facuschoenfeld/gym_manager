/**
 * Logo del gimnasio: se guarda como data URL en la tabla `config`, con clave propia.
 * No va en esquemaConfig: así no se lee en cada useConfig ni interfiere con el formulario de Configuración.
 */
import { esDataUrlLogoValida } from "@/features/configuracion/logica/logo";
import { consultarUno, ejecutarLote } from "../client";

/** Clave de la tabla config. config.ts la excluye de leerConfig para no cargar la imagen en cada lectura. */
export const CLAVE_LOGO_BD = "logo_gimnasio";

/** El logo guardado, o null si no hay logo o el valor guardado no es válido (ej. editado a mano). */
export async function leerLogo(): Promise<string | null> {
  const fila = await consultarUno<{ valor: string | null }>("SELECT valor FROM config WHERE clave = $1", [
    CLAVE_LOGO_BD,
  ]);
  const valor = fila?.valor ?? "";
  return valor !== "" && esDataUrlLogoValida(valor) ? valor : null;
}

/** Guarda el logo (data URL ya escalada). Con null, lo quita: guarda cadena vacía. */
export async function guardarLogo(dataUrl: string | null): Promise<void> {
  const valor = dataUrl ?? "";
  if (valor !== "" && !esDataUrlLogoValida(valor)) {
    throw new Error("El logo no tiene un formato válido. Volvé a elegir la imagen.");
  }
  await ejecutarLote([
    {
      sql: "INSERT INTO config (clave, valor) VALUES ($1, $2) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
      parametros: [CLAVE_LOGO_BD, valor],
    },
  ]);
}
