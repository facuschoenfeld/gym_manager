import { useEffect, useState } from "react";
import { debeActualizar } from "@/lib/saludo";

/**
 * Hora actual que se refresca sola (cada `cadaMs`, y al volver a la ventana). Así el saludo y la
 * fecha de Inicio cambian sin reiniciar la app. Solo cambia el estado cuando cambia lo que se muestra
 * (ver debeActualizar), para no re-renderizar a cada tick.
 */
export function useAhora(cadaMs = 60_000): Date {
  const [ahora, setAhora] = useState(() => new Date());

  useEffect(() => {
    const actualizar = () => {
      const nuevo = new Date();
      setAhora((previo) => (debeActualizar(previo, nuevo) ? nuevo : previo));
    };
    const intervalo = window.setInterval(actualizar, cadaMs);
    // Con la PC suspendida o la ventana minimizada, los timers se atrasan: se corrige al volver.
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", actualizar);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [cadaMs]);

  return ahora;
}
