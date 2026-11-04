import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Pago } from "@/db/queries/pagos";
import { formatearPesos } from "@/lib/dinero";
import { formatearFecha, horaDe } from "@/lib/fechas";

interface Props {
  pago: Pago;
  alCerrar: () => void;
}

/**
 * Detalle de un pago anulado: cuándo se anuló, por qué y qué pago era. El motivo se muestra
 * completo acá (en el historial sería demasiado largo para la tabla).
 */
export function DetalleAnulacionDialogo({ pago, alCerrar }: Props) {
  const hora = horaDe(pago.anuladoEl);

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && alCerrar()}>
      <DialogContent className="max-h-[calc(100vh-14rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-destructive">
            <Ban className="size-6" aria-hidden /> Pago anulado
          </DialogTitle>
          <DialogDescription className="text-base">
            El pago no se borra: queda en el historial marcado como anulado.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-xl border p-4 text-base">
          <dt className="font-medium text-muted-foreground">Anulado el</dt>
          <dd className="tabular-nums">
            {formatearFecha(pago.anuladoEl)}
            {hora ? ` a las ${hora}` : ""}
          </dd>

          <dt className="font-medium text-muted-foreground">Motivo</dt>
          {/* min-w-0 y anywhere: una palabra sin espacios no puede ensanchar la columna. */}
          <dd className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">{pago.anuladoMotivo ?? "—"}</dd>

          <dt className="font-medium text-muted-foreground">Fecha de pago</dt>
          <dd className="tabular-nums">{formatearFecha(pago.fechaPago)}</dd>

          <dt className="font-medium text-muted-foreground">Cubría hasta</dt>
          <dd className="tabular-nums">{formatearFecha(pago.venceEl)}</dd>

          <dt className="font-medium text-muted-foreground">Monto</dt>
          <dd className="tabular-nums">{formatearPesos(pago.monto)}</dd>

          <dt className="font-medium text-muted-foreground">Plan</dt>
          <dd>{pago.planNombre ?? "—"}</dd>

          <dt className="font-medium text-muted-foreground">Medio</dt>
          <dd>
            {pago.medio === "efectivo" ? "Efectivo" : "Transferencia"}
            {pago.referencia && (
              <span className="block min-w-0 [overflow-wrap:anywhere] text-muted-foreground">{pago.referencia}</span>
            )}
          </dd>
        </dl>

        <DialogFooter>
          <Button size="lg" onClick={alCerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
