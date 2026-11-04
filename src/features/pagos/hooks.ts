import { useMutation, useQueryClient } from "@tanstack/react-query";
import { anularPago, registrarPago, type DatosRegistroPago } from "@/db/queries/pagos";
import { CLAVE_PAGOS, CLAVE_SOCIOS } from "@/features/socios/hooks";

/** Un pago cambia el estado del socio y su historial: se refrescan ambos. */
function invalidarPagos(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: CLAVE_PAGOS }),
    qc.invalidateQueries({ queryKey: CLAVE_SOCIOS }),
  ]);
}

export function useRegistrarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosRegistroPago) => registrarPago(datos),
    // Sin esperar: el diálogo se cierra al instante y el listado se refresca en segundo plano.
    onSuccess: () => {
      void invalidarPagos(qc);
    },
  });
}

export function useAnularPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) => anularPago(id, motivo),
    onSuccess: () => {
      void invalidarPagos(qc);
    },
  });
}
