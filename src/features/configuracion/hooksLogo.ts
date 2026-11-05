import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { guardarLogo, leerLogo } from "@/db/queries/logo";

/** Clave de TanStack Query del logo. Usar siempre esta constante. */
export const CLAVE_LOGO = ["logo"] as const;

/** El logo como data URL, o null si no hay logo. Casi no cambia: se cachea sin vencimiento. */
export function useLogo() {
  return useQuery({ queryKey: CLAVE_LOGO, queryFn: leerLogo, staleTime: Infinity });
}

/** Guarda (o quita, con null) el logo. Invalida solo el logo: no toca la configuración ni su formulario. */
export function useGuardarLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dataUrl: string | null) => guardarLogo(dataUrl),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_LOGO }),
  });
}
