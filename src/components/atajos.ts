/** Atajos de teclado globales. */
import { useEffect, useRef } from "react";

export interface Atajo {
  /** `KeyboardEvent.key` en minúsculas: "f", "n", "/", "f2"… */
  tecla: string;
  ctrl?: boolean;
  /** Si es false (por defecto), no se dispara mientras se escribe en un campo de texto. */
  enCampos?: boolean;
  accion: () => void;
}

function escribiendoEnCampo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  return destino.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(destino.tagName);
}

export function useAtajos(atajos: Atajo[]): void {
  // Guardar la lista en una ref evita volver a registrar el listener en cada render.
  const ref = useRef(atajos);
  useEffect(() => {
    ref.current = atajos;
  });

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      const tecla = e.key.toLowerCase();
      const conCtrl = e.ctrlKey || e.metaKey;
      // Si hay un diálogo abierto, los atajos globales no deben actuar detrás. Igual se bloquea
      // la acción nativa de las combinaciones con Ctrl registradas (ej. Ctrl+F = buscar en la página).
      if (document.querySelector("[role=dialog], [role=alertdialog]")) {
        if (conCtrl && ref.current.some((a) => a.ctrl && a.tecla === tecla)) e.preventDefault();
        return;
      }
      for (const a of ref.current) {
        if (a.tecla !== tecla || (a.ctrl ?? false) !== conCtrl) continue;
        if (!a.enCampos && !a.ctrl && escribiendoEnCampo(e.target)) continue;
        e.preventDefault();
        a.accion();
        return;
      }
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);
}
