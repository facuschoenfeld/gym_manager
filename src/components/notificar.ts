/**
 * Avisos al usuario (RNF-08).
 *  - `avisar.*`: toast dentro de la app, para cada acción del usuario. Aparece y se va solo:
 *    sin botón de cerrar ni "Deshacer" (pedido del usuario).
 *  - `notificarWindows`: notificación nativa, SOLO para cosas que pasan en segundo plano
 *    (ej. respaldo automático). Si Windows no da permiso, se ignora en silencio.
 */
import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { error as logError } from "@tauri-apps/plugin-log";

interface OpcionesAviso {
  descripcion?: string;
}

function opciones(o?: OpcionesAviso) {
  return { description: o?.descripcion };
}

/** Convierte cualquier error en un texto entendible. Pura: se puede usar al renderizar. */
export function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  if (/CHECK constraint failed/i.test(texto)) return "Hay un dato con un formato inválido. Revisá los campos.";
  if (/UNIQUE constraint failed: clientes\.dni/i.test(texto)) return "Ya existe un socio con ese DNI.";
  if (/UNIQUE constraint failed: planes\.nombre/i.test(texto)) return "Ya existe un plan con ese nombre.";
  // Un solo pago vigente por socio y día (índice único parcial, migración 003).
  if (/UNIQUE constraint failed: pagos\.cliente_id, pagos\.fecha_pago/i.test(texto))
    return "Este socio ya tiene un pago en esa fecha. Si está mal, anulalo desde su historial.";
  if (/database is locked/i.test(texto)) return "La base de datos está ocupada. Probá de nuevo en unos segundos.";
  return texto;
}

/** Registra el error en el archivo de log (una vez por error, no en cada render). */
export function registrarError(contexto: string, e: unknown): void {
  const texto = e instanceof Error ? (e.stack ?? e.message) : String(e);
  void logError(`[${contexto}] ${texto}`).catch(() => undefined);
}

// Duración en pantalla. No hay botón de cerrar, así que se deja tiempo para leer (el mouse encima los pausa).
const DURACION = { exito: 6_000, info: 6_000, advertencia: 8_000, error: 10_000 } as const;

export const avisar = {
  exito: (titulo: string, o?: OpcionesAviso) => toast.success(titulo, { ...opciones(o), duration: DURACION.exito }),
  info: (titulo: string, o?: OpcionesAviso) => toast.info(titulo, { ...opciones(o), duration: DURACION.info }),
  advertencia: (titulo: string, o?: OpcionesAviso) =>
    toast.warning(titulo, { ...opciones(o), duration: DURACION.advertencia }),
  error: (titulo: string, e?: unknown) => {
    if (e !== undefined) registrarError(titulo, e);
    return toast.error(titulo, { description: e === undefined ? undefined : mensajeDeError(e), duration: DURACION.error });
  },
};

export async function notificarWindows(titulo: string, cuerpo: string): Promise<void> {
  try {
    let permitido = await isPermissionGranted();
    if (!permitido) permitido = (await requestPermission()) === "granted";
    if (permitido) sendNotification({ title: titulo, body: cuerpo });
  } catch {
    // Sin notificaciones del sistema no se pierde nada: el estado también se ve en la app.
  }
}
