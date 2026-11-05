import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useBlocker } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { Campo, idsDescripcion } from "@/components/Campo";
import { Confirmar } from "@/components/Confirmar";
import { Cargando, ErrorCarga } from "@/components/EstadosCarga";
import { Pagina } from "@/components/layout/Pagina";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Config } from "@/db/queries/config";
import { REGLAS_VENCIMIENTO, type ReglaVencimiento } from "@/lib/vencimiento";
import { cn } from "@/lib/utils";
import { useConfig, useGuardarConfig } from "./hooks";
import { TarjetaLogo } from "./TarjetaLogo";
import {
  configAFormulario,
  esquemaConfiguracion,
  type DatosConfiguracion,
  type FormularioConfiguracion,
} from "./logica/configuracion";

const EJEMPLO_REGLA: Record<ReglaVencimiento, string> = {
  desde_vencimiento_anterior:
    "Ej.: vence el 10/11 y paga el 8/11 → el nuevo vencimiento es el 10/12. Si paga cuando ya está vencido, se cuenta desde el día del pago.",
  desde_fecha_pago: "Ej.: vence el 10/11 y paga el 8/11 → el nuevo vencimiento es el 8/12.",
};

export function PaginaConfiguracion() {
  const config = useConfig();

  return (
    <Pagina titulo="Configuración" descripcion="Datos del gimnasio y reglas de vencimiento de las cuotas.">
      {config.isPending && <Cargando texto="Cargando configuración…" />}
      {config.error && <ErrorCarga error={config.error} reintentar={() => void config.refetch()} />}
      {/* Fuera del formulario: el logo se guarda al elegirlo y no depende de "Guardar cambios". */}
      {config.data && <TarjetaLogo />}
      {config.data && <FormularioGeneral config={config.data} />}
    </Pagina>
  );
}

function FormularioGeneral({ config }: { config: Config }) {
  const guardar = useGuardarConfig();
  const { register, handleSubmit, reset, watch, getValues, setFocus, formState } = useForm<
    FormularioConfiguracion,
    unknown,
    DatosConfiguracion
  >({
    resolver: zodResolver(esquemaConfiguracion),
    defaultValues: configAFormulario(config),
  });
  const e = formState.errors;

  useEffect(() => reset(configAFormulario(config)), [config, reset]);

  /** Guarda y devuelve si salió bien. */
  const guardarDatos = async (datos: DatosConfiguracion): Promise<boolean> => {
    try {
      await guardar.mutateAsync(datos);
      reset(getValues()); // lo guardado pasa a ser el nuevo punto de partida (ya no hay cambios pendientes)
      avisar.exito("Configuración guardada");
      return true;
    } catch (error) {
      avisar.error("No se pudo guardar la configuración", error);
      return false;
    }
  };

  const enviar = handleSubmit(async (datos) => {
    await guardarDatos(datos);
  });

  const regla = watch("regla_vencimiento");
  // Si hay cambios sin guardar, avisar antes de salir (menú lateral o atajos de teclado).
  // El bloqueo NO depende de isSubmitting: si se desactivara durante "Guardar y salir",
  // el diálogo se cerraría a mitad del guardado. Mientras está "blocked" el router no lo
  // vuelve a evaluar, así que después de guardar se continúa con `proceed`, que repite la
  // navegación pedida tal cual (con su estado: ej. Ctrl+N abre el alta de socio).
  const salida = useBlocker(formState.isDirty);

  const guardarYSalir = () => {
    void handleSubmit(
      async (datos) => {
        if (await guardarDatos(datos)) salida.proceed?.();
        else salida.reset?.();
      },
      (errores) => {
        salida.reset?.();
        avisar.error("Hay campos con errores. Corregilos para poder guardar.");
        // Llevar el cursor al primer campo con error (después de que se cierre el diálogo).
        const primero = Object.keys(errores)[0] as keyof FormularioConfiguracion | undefined;
        if (primero) setTimeout(() => setFocus(primero), 50);
      },
    )();
  };

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Gimnasio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Campo id="cfg-nombre" etiqueta="Nombre del gimnasio" obligatorio error={e.nombre_gimnasio?.message}>
            <Input
              id="cfg-nombre"
              aria-invalid={!!e.nombre_gimnasio}
              aria-describedby={idsDescripcion("cfg-nombre", e.nombre_gimnasio?.message)}
              {...register("nombre_gimnasio")}
            />
          </Campo>
          <Campo
            id="cfg-area"
            etiqueta="Código de área por defecto"
            ayuda="Se agrega a los teléfonos que se cargan sin código de área. Ej.: 3482 (Reconquista)"
            error={e.codigo_area?.message}
          >
            <Input
              id="cfg-area"
              inputMode="numeric"
              className="max-w-40"
              aria-invalid={!!e.codigo_area}
              aria-describedby={idsDescripcion("cfg-area", e.codigo_area?.message, true)}
              {...register("codigo_area")}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Vencimientos</CardTitle>
          <CardDescription className="text-base">
            Definen cuándo un socio aparece como "Por vencer" o "Vencido".
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Campo
              id="cfg-por-vencer"
              etiqueta={"Avisar \"por vencer\" con"}
              obligatorio
              ayuda={"Días antes del vencimiento en que el socio pasa a \"Por vencer\"."}
              error={e.dias_por_vencer?.message}
            >
              <div className="flex items-center gap-3">
                <Input
                  id="cfg-por-vencer"
                  inputMode="numeric"
                  className="max-w-28"
                  aria-invalid={!!e.dias_por_vencer}
                  aria-describedby={idsDescripcion("cfg-por-vencer", e.dias_por_vencer?.message, true)}
                  {...register("dias_por_vencer")}
                />
                <span>días de anticipación</span>
              </div>
            </Campo>
            <Campo
              id="cfg-gracia"
              etiqueta="Días de gracia"
              obligatorio
              ayuda={"Días después del vencimiento que se toleran antes de marcarlo \"Vencido\"."}
              error={e.dias_gracia?.message}
            >
              <div className="flex items-center gap-3">
                <Input
                  id="cfg-gracia"
                  inputMode="numeric"
                  className="max-w-28"
                  aria-invalid={!!e.dias_gracia}
                  aria-describedby={idsDescripcion("cfg-gracia", e.dias_gracia?.message, true)}
                  {...register("dias_gracia")}
                />
                <span>días</span>
              </div>
            </Campo>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-base font-medium">Al registrar un pago, el nuevo vencimiento se cuenta…</legend>
            {(Object.keys(REGLAS_VENCIMIENTO) as ReglaVencimiento[]).map((valor) => (
              <label
                key={valor}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring",
                  regla === valor ? "border-primary bg-muted" : "border-border hover:bg-muted/50",
                )}
              >
                <input type="radio" value={valor} className="mt-1 size-5 accent-primary" {...register("regla_vencimiento")} />
                <span>
                  <span className="block font-semibold">{REGLAS_VENCIMIENTO[valor]}</span>
                  <span className="block text-muted-foreground">{EJEMPLO_REGLA[valor]}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Mensaje de aviso por WhatsApp</CardTitle>
          <CardDescription className="text-base">
            Texto que se abre ya escrito en WhatsApp al avisar a un socio vencido. Desde WhatsApp se puede cambiar antes de enviarlo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Campo
            id="cfg-plantilla"
            etiqueta="Plantilla del mensaje"
            ayuda={"Podés usar {nombre}, {gimnasio}, {vencimiento} y {monto}. Si queda vacía, se usa el texto por defecto."}
            error={e.plantilla_aviso?.message}
          >
            <Textarea
              id="cfg-plantilla"
              rows={5}
              className="text-base"
              aria-invalid={!!e.plantilla_aviso}
              aria-describedby={idsDescripcion("cfg-plantilla", e.plantilla_aviso?.message, true)}
              {...register("plantilla_aviso")}
            />
          </Campo>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <p className="text-muted-foreground" aria-live="polite">
          {formState.isDirty ? "Hay cambios sin guardar" : "No hay cambios para guardar"}
        </p>
        <Button type="submit" size="lg" disabled={formState.isSubmitting || !formState.isDirty}>
          {formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Guardar cambios
        </Button>
      </div>

      {/* Solo informativa: va debajo del pie de guardado para que no se confunda con un campo del formulario. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Atajos de teclado</CardTitle>
          <CardDescription className="text-base">Para usar la app sin el mouse. Esta lista es solo informativa.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 text-base sm:grid-cols-[auto_1fr]">
            <dt className="font-medium">
              <kbd className="font-mono">Ctrl+F</kbd> o <kbd className="font-mono">/</kbd>
            </dt>
            <dd>Buscar socio</dd>
            <dt className="font-medium">
              <kbd className="font-mono">Ctrl+N</kbd>
            </dt>
            <dd>Nuevo socio</dd>
            <dt className="font-medium">
              <kbd className="font-mono">Ctrl+T</kbd>
            </dt>
            <dd>Registrar pago (desde la ficha del socio)</dd>
            <dt className="font-medium">
              <kbd className="font-mono">Esc</kbd>
            </dt>
            <dd>Cerrar ventana o diálogo</dd>
          </dl>
        </CardContent>
      </Card>

      <Confirmar
        abierto={salida.state === "blocked"}
        alCambiar={(abierto) => !abierto && salida.reset?.()}
        titulo="Tenés cambios sin guardar"
        descripcion="¿Querés guardar los cambios de la configuración antes de salir?"
        textoCancelar="Seguir editando"
        secundaria={{ texto: "Salir sin guardar", peligroso: true, alConfirmar: () => salida.proceed?.() }}
        accion={{ texto: "Guardar y salir", alConfirmar: guardarYSalir }}
        procesando={formState.isSubmitting}
      />
    </form>
  );
}
