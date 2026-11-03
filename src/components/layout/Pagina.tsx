import type { ReactNode } from "react";

interface Props {
  titulo: string;
  descripcion?: string;
  /** Botones a la derecha del título. */
  acciones?: ReactNode;
  children: ReactNode;
}

/** Encabezado + contenido estándar de cada pantalla. */
export function Pagina({ titulo, descripcion, acciones, children }: Props) {
  // pb-28: aire al final para poder bajar con el scroll los botones del pie (ej. "Guardar
  // cambios") por encima de la zona donde aparecen los avisos, abajo a la derecha.
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-8 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
          {descripcion && <p className="mt-1 text-muted-foreground">{descripcion}</p>}
        </div>
        {acciones && <div className="flex gap-2">{acciones}</div>}
      </header>
      {children}
    </div>
  );
}

/** Marcador para pantallas que se construyen en fases siguientes. */
export function EnConstruccion({ titulo, fase }: { titulo: string; fase: number }) {
  return (
    <Pagina titulo={titulo}>
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        Esta sección se construye en la fase {fase}.
      </div>
    </Pagina>
  );
}
