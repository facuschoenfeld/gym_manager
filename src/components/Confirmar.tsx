import type { ReactNode } from "react";
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
import { cn } from "@/lib/utils";

interface Props {
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion: ReactNode;
  textoConfirmar: string;
  /** Acción destructiva (dar de baja, anular, restaurar): botón rojo. */
  peligroso?: boolean;
  procesando?: boolean;
  alConfirmar: () => void;
}

/** Confirmación antes de una acción importante. "Cancelar" queda enfocado por defecto. */
export function Confirmar({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  textoConfirmar,
  peligroso,
  procesando,
  alConfirmar,
}: Props) {
  return (
    <AlertDialog open={abierto} onOpenChange={alCambiar}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{titulo}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={procesando}
            className={cn(peligroso && "bg-destructive text-white hover:bg-destructive/90 dark:bg-red-700 dark:hover:bg-red-600")}
            onClick={(e) => {
              e.preventDefault(); // se cierra cuando termina la acción, no antes
              alConfirmar();
            }}
          >
            {procesando && <Loader2 className="animate-spin" aria-hidden />}
            {textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
