import { useRef, useState } from "react";
import { CircleCheck, CircleDashed, Dumbbell, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Confirmar } from "@/components/Confirmar";
import { ErrorCarga } from "@/components/EstadosCarga";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuardarLogo, useLogo } from "./hooksLogo";
import { procesarImagenLogo } from "./logica/imagenLogo";
import { clasesCajaLogo, TIPOS_LOGO_ACEPTADOS, validarArchivoLogo } from "./logica/logo";

const ACEPTAR = TIPOS_LOGO_ACEPTADOS.join(",");

/**
 * Tarjeta para elegir o quitar el logo del gimnasio. Se guarda al elegirlo (no con "Guardar cambios"):
 * es un archivo, y así no se mezcla con el formulario de la configuración ni con su aviso de cambios.
 */
export function TarjetaLogo() {
  const logo = useLogo();
  const guardar = useGuardarLogo();
  const entrada = useRef<HTMLInputElement>(null);
  // Botón que el foco vuelve a ocupar al cerrar la confirmación de "Quitar" (sigue habilitado).
  const botonElegir = useRef<HTMLButtonElement>(null);
  const [procesando, setProcesando] = useState(false);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  const ocupado = procesando || guardar.isPending;
  const tieneLogo = logo.data !== null && logo.data !== undefined;

  const alElegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    const validacion = validarArchivoLogo(archivo);
    if (!validacion.ok) {
      avisar.advertencia("No se puede usar esa imagen", { descripcion: validacion.motivo });
      return;
    }
    setProcesando(true);
    try {
      const logoProcesado = await procesarImagenLogo(archivo);
      await guardar.mutateAsync(logoProcesado);
      avisar.exito("Logo guardado", { descripcion: "Ya aparece en Inicio." });
    } catch (e) {
      avisar.error("No se pudo guardar el logo", e);
    } finally {
      setProcesando(false);
      // Para poder volver a elegir el mismo archivo: si no se vacía, el navegador no dispara onChange.
      if (entrada.current) entrada.current.value = "";
      // El botón estaba deshabilitado mientras procesaba: se devuelve el foco cuando vuelve a estar habilitado.
      requestAnimationFrame(() => botonElegir.current?.focus());
    }
  };

  const quitar = async () => {
    try {
      await guardar.mutateAsync(null);
      setConfirmarQuitar(false);
      avisar.exito("Logo quitado", { descripcion: "Inicio muestra el ícono de siempre." });
    } catch (e) {
      avisar.error("No se pudo quitar el logo", e);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Logo del gimnasio</CardTitle>
        <CardDescription className="text-base">
          Aparece grande en Inicio. Se guarda al elegirlo: no hace falta apretar "Guardar cambios". El fondo se
          elige solo para que se vea bien.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 md:flex-row md:items-center">
        {logo.error && (
          <div className="w-full">
            <ErrorCarga error={logo.error} reintentar={() => void logo.refetch()} />
          </div>
        )}
        <div className="flex flex-col items-center gap-3">
          {/* La caja contrasta con el logo (ver fondoParaLuminancia): el logo nunca queda del mismo color que el fondo. */}
          <div
            className={`flex size-40 items-center justify-center rounded-xl border-2 p-3 ${clasesCajaLogo(logo.data?.fondo ?? "claro")}`}
          >
            {logo.isPending && (
              <div role="status" className="flex flex-col items-center gap-1 text-gray-700">
                <Loader2 className="size-10 animate-spin" aria-hidden />
                <span className="sr-only">Cargando logo</span>
              </div>
            )}
            {!logo.isPending && tieneLogo && (
              <img src={logo.data?.dataUrl ?? ""} alt="Logo actual del gimnasio" className="max-h-full max-w-full object-contain" />
            )}
            {!logo.isPending && !tieneLogo && <Dumbbell className="size-16 text-gray-700" aria-hidden />}
          </div>
          {!logo.isPending && !logo.error &&
            (tieneLogo ? (
              <p className="flex items-center gap-2 text-base font-medium text-green-800 dark:text-green-300">
                <CircleCheck className="size-5" aria-hidden /> Logo cargado
              </p>
            ) : (
              <p className="flex items-center gap-2 text-base font-medium text-muted-foreground">
                <CircleDashed className="size-5" aria-hidden /> Todavía no cargaste un logo
              </p>
            ))}
        </div>

        <div className="flex flex-col gap-3">
          {/* Sin logo leído correctamente no se permite elegir otro: podría pisar el guardado sin avisar. */}
          <Button
            ref={botonElegir}
            size="lg"
            onClick={() => entrada.current?.click()}
            disabled={ocupado || logo.isPending || !!logo.error}
          >
            {ocupado ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {tieneLogo ? "Cambiar imagen" : "Elegir imagen"}
          </Button>
          <Button size="lg" variant="outline" onClick={() => setConfirmarQuitar(true)} disabled={ocupado || !tieneLogo}>
            <Trash2 aria-hidden /> Quitar logo
          </Button>
          <p className="text-base text-muted-foreground">PNG, JPG o WebP, hasta 10 MB. Se achica solo.</p>
          {procesando && (
            <p role="status" className="text-base font-medium">
              Procesando la imagen…
            </p>
          )}
          {/* Oculto: el botón de arriba es quien lo abre. Sin aria-label porque no es enfocable. */}
          <input
            ref={entrada}
            type="file"
            accept={ACEPTAR}
            className="hidden"
            onChange={(e) => void alElegir(e.target.files?.[0])}
          />
        </div>
      </CardContent>

      <Confirmar
        abierto={confirmarQuitar}
        alCambiar={setConfirmarQuitar}
        titulo="¿Quitar el logo?"
        descripcion="Inicio va a mostrar el ícono de siempre. Podés volver a cargarlo cuando quieras."
        accion={{ texto: "Quitar logo", peligroso: true, alConfirmar: () => void quitar() }}
        procesando={guardar.isPending}
        focoAlCerrar={botonElegir}
      />
    </Card>
  );
}
