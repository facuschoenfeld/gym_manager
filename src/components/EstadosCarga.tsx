import type { ReactNode } from "react";
import { Inbox, Loader2, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mensajeDeError } from "@/components/notificar";

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-12 text-lg text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function ErrorCarga({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 p-10 text-center">
      <TriangleAlert className="size-10 text-destructive" aria-hidden />
      <p className="text-lg font-semibold">No se pudieron cargar los datos</p>
      <p className="max-w-xl text-muted-foreground">{mensajeDeError(error)}</p>
      {reintentar && (
        <Button size="lg" variant="outline" onClick={reintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

interface PropsVacio {
  titulo: string;
  descripcion?: string;
  icono?: LucideIcon;
  /** Botón de acción principal (ej. "Agregar el primer socio"). */
  accion?: ReactNode;
}

export function Vacio({ titulo, descripcion, icono: Icono = Inbox, accion }: PropsVacio) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
      <Icono className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-lg font-semibold">{titulo}</p>
      {descripcion && <p className="max-w-xl text-muted-foreground">{descripcion}</p>}
      {accion}
    </div>
  );
}
