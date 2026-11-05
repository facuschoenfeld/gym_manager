import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ingresosDelMes, registrarAviso, type TipoAviso } from "@/db/queries/avisos";
import type { FechaISO } from "@/lib/fechas";
import { CLAVE_PAGOS, CLAVE_SOCIOS } from "@/features/socios/hooks";

/** Clave de los ingresos del mes de una fecha (se refrescan con cualquier cambio de pagos). */
export const claveIngresosDelMes = (hoy: FechaISO) => [...CLAVE_PAGOS, "ingresos", hoy.slice(0, 7)] as const;

export function useIngresosDelMes(hoy: FechaISO) {
  return useQuery({ queryKey: claveIngresosDelMes(hoy), queryFn: () => ingresosDelMes(hoy) });
}

/** Registra un aviso enviado. Cambia "último aviso" del socio: se refrescan los socios. */
export function useRegistrarAviso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clienteId, tipo }: { clienteId: number; tipo: TipoAviso }) => registrarAviso(clienteId, tipo),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_SOCIOS }),
  });
}
