/**
 * Virtualiza las filas de una tabla: solo se montan las visibles (más un margen), para que listas de cientos
 * de socios no consuman memoria ni tiempo de dibujado. El scroll es el de la página (#contenido, ver Layout).
 */
import { useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/** Id del elemento que hace scroll en la app. Ver Layout.tsx. */
const ID_SCROLL = "contenido";
/** Alto aproximado de una fila antes de medirla. Cada fila se mide al montarse. */
const ALTO_ESTIMADO = 84;

export function useVirtualFilas(cantidad: number) {
  const ref = useRef<HTMLDivElement>(null);
  // Distancia entre el inicio del scroll de la página y el inicio de la tabla (hay títulos y filtros arriba).
  const [margen, setMargen] = useState(0);

  const virtualizador = useVirtualizer({
    count: cantidad,
    getScrollElement: () => document.getElementById(ID_SCROLL),
    estimateSize: () => ALTO_ESTIMADO,
    overscan: 12,
    scrollMargin: margen,
  });

  // Recalcula la distancia cuando cambia la lista (los filtros cambian el alto de lo que está arriba) o la ventana.
  // Si la distancia no cambió, React no vuelve a renderizar.
  useLayoutEffect(() => {
    const medir = () => {
      const main = document.getElementById(ID_SCROLL);
      const el = ref.current;
      if (!main || !el) return;
      setMargen(el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [cantidad]);

  return { ref, virtualizador, margen };
}
