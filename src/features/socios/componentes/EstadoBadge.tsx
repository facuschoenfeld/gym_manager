/** Estado de la cuota con color + texto + ícono (nunca solo color). */
import { CircleAlert, CircleCheck, CircleDashed, Clock, type LucideIcon } from "lucide-react";
import type { EstadoSocio } from "@/lib/estado";
import { cn } from "@/lib/utils";

interface Visual {
  etiqueta: string;
  icono: LucideIcon;
  clases: string;
  /** Color del ícono suelto (ej. en los botones de filtro). */
  colorIcono: string;
}

export const VISUAL_ESTADO: Record<EstadoSocio, Visual> = {
  pago: {
    etiqueta: "Al día",
    colorIcono: "text-green-700 dark:text-green-400",
    icono: CircleCheck,
    clases: "border-green-700/40 bg-green-50 text-green-800 dark:border-green-400/40 dark:bg-green-950 dark:text-green-300",
  },
  por_vencer: {
    etiqueta: "Por vencer",
    colorIcono: "text-amber-700 dark:text-amber-400",
    icono: Clock,
    clases: "border-amber-600/50 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950 dark:text-amber-300",
  },
  vencido: {
    etiqueta: "Vencido",
    colorIcono: "text-red-700 dark:text-red-400",
    icono: CircleAlert,
    clases: "border-red-700/40 bg-red-50 text-red-800 dark:border-red-400/40 dark:bg-red-950 dark:text-red-300",
  },
  sin_pagos: {
    etiqueta: "Sin pagos",
    colorIcono: "text-slate-600 dark:text-slate-400",
    icono: CircleDashed,
    clases: "border-slate-400/60 bg-slate-100 text-slate-700 dark:border-slate-500/50 dark:bg-slate-800 dark:text-slate-300",
  },
};

export function EstadoBadge({ estado, grande }: { estado: EstadoSocio; grande?: boolean }) {
  const { etiqueta, icono: Icono, clases } = VISUAL_ESTADO[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        grande ? "px-4 py-1.5 text-lg" : "px-2.5 py-0.5 text-sm",
        clases,
      )}
    >
      <Icono className={grande ? "size-5" : "size-4"} aria-hidden />
      {etiqueta}
    </span>
  );
}
