import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";
import { obtenerDb } from "@/db/client";
import { mensajeDeError } from "@/components/notificar";
import { ProveedorTema } from "@/components/tema";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { EnConstruccion } from "@/components/layout/Pagina";
import { PaginaInicio } from "@/features/deudores/PaginaInicio";

const queryClient = new QueryClient({
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
      .catch((e: unknown) => vigente && setEstado({ tipo: "error", mensaje: mensajeDeError(e) }));
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

function Rutas() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PaginaInicio />} />
        <Route path="socios" element={<EnConstruccion titulo="Socios" fase={2} />} />
        <Route path="planes" element={<EnConstruccion titulo="Planes" fase={2} />} />
        <Route path="importar" element={<EnConstruccion titulo="Importar Excel" fase={5} />} />
        <Route path="configuracion" element={<EnConstruccion titulo="Configuración" fase={2} />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { estado, reintentar } = useAbrirBase();

  return (
    <ProveedorTema>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          {estado.tipo === "lista" && (
            <HashRouter>
              <Rutas />
            </HashRouter>
          )}
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
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ProveedorTema>
  );
}
