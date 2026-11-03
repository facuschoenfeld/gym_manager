import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { actualizarPlan, cambiarActivoPlan, crearPlan, listarPlanes } from "@/db/queries/planes";
import { CLAVE_SOCIOS } from "@/features/socios/hooks";
import type { DatosPlan } from "./logica/plan";

export const CLAVE_PLANES = ["planes"] as const;

export function usePlanes() {
  return useQuery({ queryKey: CLAVE_PLANES, queryFn: listarPlanes });
}

export function useGuardarPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, datos }: { id: number | null; datos: DatosPlan }): Promise<void> => {
      if (id === null) await crearPlan(datos);
      else await actualizarPlan(id, datos);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: CLAVE_PLANES });
      await qc.invalidateQueries({ queryKey: CLAVE_SOCIOS }); // muestran nombre y precio del plan
    },
  });
}

export function useCambiarActivoPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => cambiarActivoPlan(id, activo),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_PLANES }),
  });
}
