import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listarPagosDeSocio } from "@/db/queries/pagos";
import { actualizarSocio, cambiarActivoSocio, crearSocio, listarSocios } from "@/db/queries/socios";
import { useConfig } from "@/features/configuracion/hooks";
import { hoyISO } from "@/lib/fechas";
import { agregarEstado, type DatosSocio, type SocioConEstado } from "./logica/socio";

/** Claves de TanStack Query. Usar siempre estas constantes (nunca strings sueltos) para invalidar. */
export const CLAVE_SOCIOS = ["socios"] as const;
export const CLAVE_PAGOS = ["pagos"] as const;
export const clavePagosDeSocio = (id: number) => [...CLAVE_PAGOS, id] as const;

export function useSociosCrudos() {
  return useQuery({ queryKey: CLAVE_SOCIOS, queryFn: listarSocios });
}

/** Socios con su estado calculado (depende de la configuración y de la fecha de hoy). */
export function useSocios() {
  const socios = useSociosCrudos();
  const config = useConfig();
  const hoy = hoyISO();
  const datos = useMemo<SocioConEstado[] | undefined>(() => {
    if (!socios.data || !config.data) return undefined;
    return agregarEstado(socios.data, hoy, {
      diasPorVencer: config.data.dias_por_vencer,
      diasGracia: config.data.dias_gracia,
    });
  }, [socios.data, config.data, hoy]);
  return {
    data: datos,
    isPending: socios.isPending || config.isPending,
    error: socios.error ?? config.error,
    // Reintentar lo que haya fallado: los socios y también la configuración.
    refetch: () => Promise.all([socios.refetch(), config.refetch()]),
  };
}

export function usePagosDeSocio(id: number) {
  return useQuery({
    queryKey: clavePagosDeSocio(id),
    queryFn: () => listarPagosDeSocio(id),
    enabled: Number.isInteger(id) && id > 0, // ej. /socios/abc no consulta la base
  });
}

export function useGuardarSocio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, datos }: { id: number | null; datos: DatosSocio }) => {
      if (id === null) return crearSocio(datos);
      await actualizarSocio(id, datos);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_SOCIOS }),
  });
}

export function useCambiarActivoSocio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => cambiarActivoSocio(id, activo),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_SOCIOS }),
  });
}
