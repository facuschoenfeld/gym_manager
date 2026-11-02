/**
 * Avisos al usuario (RNF-08).
 *  - `avisar.*`: toast dentro de la app, para cada acción del usuario.
 *  - `notificarWindows`: notificación nativa, SOLO para cosas que pasan en segundo plano
 *    (ej. respaldo automático). Si Windows no da permiso, se ignora en silencio.
 */
import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { error as logError } from "@tauri-apps/plugin-log";

interface OpcionesAviso {
  descripcion?: string;
  /** Botón "Deshacer" (u otra acción) dentro del toast. */
  accion?: { etiqueta: string; alHacerClic: () => void };
}

function opciones(o?: OpcionesAviso) {
  return {
    description: o?.descripcion,
    action: o?.accion ? { label: o.accion.etiqueta, onClick: o.accion.alHacerClic } : undefined,
  };
}

/** Convierte cualquier error en un texto entendible y lo registra en el log. */
export function mensajeDeError(e: unknown): string {
  const texto = e instanceof Error ? e.message : String(e);
  void logError(texto).catch(() => undefined);
  if (/UNIQUE constraint failed: clientes\.dni/i.test(texto)) return "Ya existe un socio con ese DNI.";
  if (/UNIQUE constraint failed: planes\.nombre/i.test(texto)) return "Ya existe un plan con ese nombre.";
  if (/database is locked/i.test(texto)) return "La base de datos está ocupada. Probá de nuevo en unos segundos.";
  return texto;
}

export const avisar = {
  exito: (titulo: string, o?: OpcionesAviso) => toast.success(titulo, opciones(o)),
  info: (titulo: string, o?: OpcionesAviso) => toast.info(titulo, opciones(o)),
  advertencia: (titulo: string, o?: OpcionesAviso) => toast.warning(titulo, opciones(o)),
  error: (titulo: string, e?: unknown) =>
    toast.error(titulo, { description: e === undefined ? undefined : mensajeDeError(e), duration: 10_000 }),
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
