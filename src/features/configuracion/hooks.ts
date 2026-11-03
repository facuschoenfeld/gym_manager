import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guardarConfig, leerConfig, type Config } from "@/db/queries/config";

export const CLAVE_CONFIG = ["config"] as const;

export function useConfig() {
  return useQuery({ queryKey: CLAVE_CONFIG, queryFn: leerConfig, staleTime: Infinity });
}

export function useGuardarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cambios: Partial<Config>) => guardarConfig(cambios),
    // Los estados de los socios dependen de los días de aviso y de gracia: recalcular todo.
    // onSettled (no onSuccess): si falló, igual se relee lo que quedó en la base.
    onSettled: () => qc.invalidateQueries(),
  });
}
