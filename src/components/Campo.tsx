import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";

interface Props {
  /** id del control, para enlazar la etiqueta y el mensaje de error. */
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  ayuda?: string;
  error?: string | undefined;
  children: ReactNode;
}

/**
 * Etiqueta + control + ayuda/error. El control (Input, Select…) lo pone quien lo usa,
 * con `id={id}`, `aria-invalid` y `aria-describedby={idsDescripcion(id, error, ayuda)}`.
 */
export function Campo({ id, etiqueta, obligatorio, ayuda, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-base">
        {etiqueta}
        {obligatorio ? (
          <>
            <span className="text-destructive" aria-hidden>
              *
            </span>
            <span className="sr-only">(obligatorio)</span>
          </>
        ) : (
          <span className="font-normal text-muted-foreground">(opcional)</span>
        )}
      </Label>
      {children}
      {ayuda && !error && (
        <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/** Valor de aria-describedby para el control: el error si lo hay, si no la ayuda (cuando el Campo tiene ayuda). */
export function idsDescripcion(id: string, error?: string, tieneAyuda = false): string | undefined {
  if (error) return `${id}-error`;
  if (tieneAyuda) return `${id}-ayuda`;
  return undefined;
}
