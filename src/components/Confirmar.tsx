import type { ReactNode, RefObject } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const CLASES_PELIGRO = "bg-destructive text-white hover:bg-destructive/90 dark:bg-red-700 dark:hover:bg-red-600";
/** Acción secundaria peligrosa: contorno rojo, para que no compita con el botón principal. */
export const CLASES_PELIGRO_SECUNDARIA =
  "border-red-700/60 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-400/60 dark:text-red-300 dark:hover:bg-red-950 dark:hover:text-red-200";

export interface AccionConfirmar {
  texto: string;
  alConfirmar: () => void;
  /** Acción destructiva (dar de baja, eliminar, salir sin guardar): rojo. */
  peligroso?: boolean;
}

interface Props {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion: ReactNode;
  /** Acción principal. Si no se pasa, el diálogo es solo informativo (un botón para cerrar). */
  accion?: AccionConfirmar;
  /** Acción alternativa, entre "Cancelar" y la principal (ej. "Salir sin guardar"). */
  secundaria?: AccionConfirmar;
  textoCancelar?: string;
  procesando?: boolean;
  /**
   * Adónde vuelve el foco al cerrar (ej. el botón que abrió el diálogo). Sin esto el foco
   * queda en la página y quien usa el teclado pierde su lugar.
   */
  focoAlCerrar?: RefObject<HTMLElement | null>;
}

/** Confirmación antes de una acción importante. El botón de cancelar queda enfocado por defecto. */
export function Confirmar({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  accion,
  secundaria,
  textoCancelar,
  procesando,
  focoAlCerrar,
}: Props) {
  // Mientras procesa no se puede cerrar (Esc o clic afuera) para no cortar la operación a la mitad.
  return (
    <AlertDialog open={abierto} onOpenChange={(a) => !procesando && alCambiar(a)}>
      <AlertDialogContent
        // Misma variante que el componente base (data-[size=default]:sm:max-w-sm) para que `cn`
        // la reemplace: con "sm:max-w-*" a secas ganaba la base por especificidad y la caja
        // quedaba en 384 px, con los botones saliéndose del recuadro.
        className={cn(secundaria ? "data-[size=default]:sm:max-w-2xl" : "data-[size=default]:sm:max-w-lg")}
        onCloseAutoFocus={(e) => {
          const destino = focoAlCerrar?.current;
          if (destino?.isConnected) {
            e.preventDefault();
            destino.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{titulo}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={procesando}>{textoCancelar ?? (accion ? "Cancelar" : "Entendido")}</AlertDialogCancel>
          {secundaria && (
            <Button
              variant="outline"
              disabled={procesando}
              className={cn(secundaria.peligroso && CLASES_PELIGRO_SECUNDARIA)}
              onClick={secundaria.alConfirmar}
            >
              {secundaria.texto}
            </Button>
          )}
          {accion && (
            <AlertDialogAction
              disabled={procesando}
              className={cn(accion.peligroso && CLASES_PELIGRO)}
              onClick={(e) => {
                e.preventDefault(); // se cierra cuando termina la acción, no antes
                accion.alConfirmar();
              }}
            >
              {procesando && <Loader2 className="animate-spin" aria-hidden />}
              {accion.texto}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
