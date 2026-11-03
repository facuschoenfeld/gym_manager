import { useEffect, useState } from "react";
import { createHashRouter, RouterProvider } from "react-router";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";
import { obtenerDb } from "@/db/client";
import { mensajeDeError, registrarError } from "@/components/notificar";
import { ProveedorTema } from "@/components/tema";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { EnConstruccion } from "@/components/layout/Pagina";
import { PaginaInicio } from "@/features/deudores/PaginaInicio";
import { PaginaConfiguracion } from "@/features/configuracion/PaginaConfiguracion";
import { PaginaPlanes } from "@/features/planes/PaginaPlanes";
import { FichaSocio } from "@/features/socios/FichaSocio";
import { PaginaSocios } from "@/features/socios/PaginaSocios";

const queryClient = new QueryClient({
  // Cada error de lectura se registra en el log UNA vez (no en cada render de la pantalla de error).
  queryCache: new QueryCache({ onError: (e, consulta) => registrarError(`consulta ${JSON.stringify(consulta.queryKey)}`, e) }),
  defaultOptions: {
    // Datos locales: no hace falta refrescar al volver a la ventana.
    queries: { refetchOnWindowFocus: false, retry: false, staleTime: 30_000 },
  },
});

type EstadoDb = { tipo: "abriendo" } | { tipo: "lista" } | { tipo: "error"; mensaje: string };

/** Abre la base (y corre las migraciones) antes de mostrar la app. */
function useAbrirBase() {
  const [estado, setEstado] = useState<EstadoDb>({ tipo: "abriendo" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerDb()
      .then(() => vigente && setEstado({ tipo: "lista" }))
      .catch((e: unknown) => {
        registrarError("abrir base de datos", e);
        if (vigente) setEstado({ tipo: "error", mensaje: mensajeDeError(e) });
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = () => {
    setEstado({ tipo: "abriendo" });
    setIntento((i) => i + 1);
  };
  return { estado, reintentar };
}

// Router "de datos": permite useBlocker (avisar antes de salir con cambios sin guardar).
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <PaginaInicio /> },
      { path: "socios", element: <PaginaSocios /> },
      { path: "socios/:id", element: <FichaSocio /> },
      { path: "planes", element: <PaginaPlanes /> },
      { path: "importar", element: <EnConstruccion titulo="Importar Excel" fase={5} /> },
      { path: "configuracion", element: <PaginaConfiguracion /> },
    ],
  },
]);

export default function App() {
  const { estado, reintentar } = useAbrirBase();

  return (
    <ProveedorTema>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {estado.tipo === "lista" && <RouterProvider router={router} />}
          {estado.tipo === "abriendo" && (
            <div className="flex h-screen items-center justify-center gap-3 text-lg text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden /> Abriendo la base de datos…
            </div>
          )}
          {estado.tipo === "error" && (
            <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-center">
              <TriangleAlert className="size-12 text-destructive" aria-hidden />
              <h1 className="text-2xl font-semibold">No se pudo abrir la base de datos</h1>
              <p className="max-w-xl text-muted-foreground">{estado.mensaje}</p>
              <Button size="lg" onClick={reintentar}>
                Reintentar
              </Button>
            </div>
          )}
          {/* Los avisos aparecen y se van solos (sin botón de cerrar). Abajo a la izquierda, sobre el
              menú lateral: así no tapan los botones de guardar, que están abajo a la derecha. */}
          <Toaster position="bottom-left" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ProveedorTema>
  );
}
