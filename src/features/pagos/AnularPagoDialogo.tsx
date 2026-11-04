import type { RefObject } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, TriangleAlert } from "lucide-react";
import { Campo, idsDescripcion } from "@/components/Campo";
import { avisar } from "@/components/notificar";
import { CLASES_PELIGRO } from "@/components/Confirmar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Pago } from "@/db/queries/pagos";
import { useConfig } from "@/features/configuracion/hooks";
import { EstadoBadge } from "@/features/socios/componentes/EstadoBadge";
import { formatearPesos } from "@/lib/dinero";
import { calcularEstado, describirVencimiento } from "@/lib/estado";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { useAnularPago } from "./hooks";
import { esquemaAnulacion, hayPagosPosteriores, venceElSinPago } from "./logica/pago";


interface Props {
  pago: Pago;
  /** Todos los pagos del socio (incluidos los anulados), para calcular cómo queda después. */
  pagos: Pago[];
  nombreSocio: string;
  alCerrar: () => void;
  /** Adónde vuelve el foco al cerrar (el botón de la ficha; el de la fila ya no existe). */
  focoAlCerrar?: RefObject<HTMLElement | null>;
}

/**
 * Anular un pago (F-PAG-04). Pide un motivo: el pago no se borra, queda en el historial marcado.
 * Muestra cómo quedaría el socio después, así se sabe qué pasa antes de confirmar.
 */
export function AnularPagoDialogo({ pago, pagos, nombreSocio, alCerrar, focoAlCerrar }: Props) {
  const anular = useAnularPago();
  const config = useConfig();
  const hoy = hoyISO();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ motivo: string }>({
    resolver: zodResolver(esquemaAnulacion),
    defaultValues: { motivo: "" },
  });

  const enviar = handleSubmit(async ({ motivo }) => {
    try {
      await anular.mutateAsync({ id: pago.id, motivo });
      avisar.exito("Pago anulado", {
        descripcion: `${nombreSocio} · ${formatearPesos(pago.monto)} del ${formatearFecha(pago.fechaPago)}`,
      });
      alCerrar();
    } catch (error) {
      avisar.error("No se pudo anular el pago", error);
    }
  });

  const procesando = isSubmitting || anular.isPending;

  // Cómo quedaría el socio sin este pago (mismo cálculo que el estado real).
  const venceTras = venceElSinPago(pagos, pago.id);
  const posteriores = hayPagosPosteriores(pagos, pago.id);
  const estadoTras = config.data
    ? calcularEstado(venceTras, hoy, { diasPorVencer: config.data.dias_por_vencer, diasGracia: config.data.dias_gracia })
    : null;

  return (
    <Dialog open onOpenChange={(abierto) => !procesando && !abierto && alCerrar()}>
      <DialogContent
        className="max-h-[calc(100vh-14rem)] overflow-y-auto sm:max-w-xl"
        onCloseAutoFocus={(e) => {
          const destino = focoAlCerrar?.current;
          // Un botón deshabilitado no recibe el foco: en ese caso se deja el comportamiento por defecto.
          if (destino?.isConnected && !(destino instanceof HTMLButtonElement && destino.disabled)) {
            e.preventDefault();
            destino.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">¿Anular este pago?</DialogTitle>
          <DialogDescription className="text-base">
            El pago no se borra: queda en el historial marcado como anulado.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 rounded-xl border p-4 text-base">
          <dt className="font-medium text-muted-foreground">Fecha de pago</dt>
          <dd className="tabular-nums">{formatearFecha(pago.fechaPago)}</dd>
          <dt className="font-medium text-muted-foreground">Cubría hasta</dt>
          <dd className="tabular-nums">{formatearFecha(pago.venceEl)}</dd>
          <dt className="font-medium text-muted-foreground">Monto</dt>
          <dd className="tabular-nums">{formatearPesos(pago.monto)}</dd>
        </dl>

        <div className="rounded-xl border-2 p-4" aria-live="polite">
          <p className="text-base font-medium text-muted-foreground">Después de anular, {nombreSocio}:</p>
          {estadoTras ? (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <EstadoBadge estado={estadoTras} grande />
              <span className="text-base">
                {venceTras
                  ? `Vence el ${formatearFecha(venceTras)} (${describirVencimiento(venceTras, hoy)})`
                  : "No le queda ningún pago vigente"}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-base text-muted-foreground">Calculando…</p>
          )}
        </div>

        {posteriores && (
          <div role="alert" className="flex gap-3 rounded-xl border-2 border-amber-600/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
            <p className="text-base">
              Hay pagos cargados después de este, calculados a partir de él. <strong>No se recalculan:</strong> revisalos a mano después de anular.
            </p>
          </div>
        )}

        <form id="form-anular-pago" onSubmit={enviar} noValidate>
          <Campo id="anular-motivo" etiqueta="Motivo de la anulación" obligatorio error={errors.motivo?.message}>
            <Textarea
              id="anular-motivo"
              rows={3}
              autoFocus
              className="text-base"
              aria-invalid={!!errors.motivo}
              aria-describedby={idsDescripcion("anular-motivo", errors.motivo?.message)}
              placeholder="Ej.: cargado dos veces, monto equivocado, transferencia no acreditada"
              {...register("motivo")}
            />
          </Campo>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={alCerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-anular-pago" size="lg" disabled={procesando} className={CLASES_PELIGRO}>
            {procesando && <Loader2 className="animate-spin" aria-hidden />}
            Anular pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
