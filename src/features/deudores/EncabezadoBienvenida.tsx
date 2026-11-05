import { Link } from "react-router";
import { ImagePlus, Loader2 } from "lucide-react";
import { Cargando, ErrorCarga } from "@/components/EstadosCarga";
import { Button } from "@/components/ui/button";
import { useAhora } from "@/components/useAhora";
import { useConfig } from "@/features/configuracion/hooks";
import { useLogo } from "@/features/configuracion/hooksLogo";
import { clasesCajaLogo } from "@/features/configuracion/logica/logo";
import { textoSaludo } from "@/lib/saludo";

/** Alto reservado para el logo: así no salta el diseño cuando llega. */
const ALTO_LOGO = "h-48";

/**
 * Encabezado de Inicio: logo del gimnasio grande y centrado, "Bienvenido a <nombre>" y el saludo
 * con la fecha de hoy. Sin logo, muestra un ícono y un enlace para cargarlo en Configuración.
 */
export function EncabezadoBienvenida() {
  const config = useConfig();
  const logo = useLogo();
  const ahora = useAhora();

  // Mientras carga no se muestra ningún nombre, para no mostrar "Mi Gimnasio" por un instante.
  if (config.isPending) return <Cargando texto="Cargando…" />;
  if (config.error) return <ErrorCarga error={config.error} reintentar={() => void config.refetch()} />;

  const nombre = config.data.nombre_gimnasio;
  const tieneLogo = logo.data !== null && logo.data !== undefined;

  return (
    <section aria-label="Bienvenida" className="flex flex-col items-center gap-5 text-center">
      <div className={`flex ${ALTO_LOGO} items-center justify-center`}>
        {logo.isPending && (
          <div role="status" className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden /> Cargando logo…
          </div>
        )}
        {!logo.isPending && logo.error && (
          <div className="flex flex-col items-center gap-3">
            <img src="/icono_gym-manager-sin-fondo.svg" alt="" className="size-16" />
            <p role="alert" className="text-base font-medium text-destructive">
              No se pudo leer el logo guardado.
            </p>
            <Button asChild variant="outline" size="lg">
              <Link to="/configuracion">Revisar el logo en Configuración</Link>
            </Button>
          </div>
        )}
        {!logo.isPending && !logo.error && tieneLogo && (
          // La caja contrasta con el logo: oscura si el logo es claro (ej. letras blancas), clara si es oscuro.
          <div className={`rounded-2xl border p-4 shadow-sm ${clasesCajaLogo(logo.data?.fondo ?? "claro")}`}>
            <img src={logo.data?.dataUrl ?? ""} alt={`Logo de ${nombre}`} className={`${ALTO_LOGO} max-w-full object-contain`} />
          </div>
        )}
        {!logo.isPending && !logo.error && !tieneLogo && (
          <div className="flex flex-col items-center gap-4">
            {/* Sin logo cargado se muestra la marca de la app (la misma de la barra lateral). */}
            <img src="/icono_gym-manager-sin-fondo.svg" alt="" className="size-20" />
            <Button asChild variant="outline" size="lg">
              <Link to="/configuracion">
                <ImagePlus aria-hidden /> Cargá el logo de tu gimnasio
              </Link>
            </Button>
          </div>
        )}
      </div>

      <h2 className="max-w-3xl text-2xl font-semibold break-words">Bienvenido a {nombre}</h2>
      <p className="text-xl text-foreground">{textoSaludo(ahora)}</p>
    </section>
  );
}
