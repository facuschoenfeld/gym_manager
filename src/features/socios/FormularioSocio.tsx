import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import { Loader2, TriangleAlert } from "lucide-react";
import { Campo, idsDescripcion } from "@/components/Campo";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useConfig } from "@/features/configuracion/hooks";
import { usePlanes } from "@/features/planes/hooks";
import { planesElegibles } from "@/features/planes/logica/plan";
import { formatearPesos } from "@/lib/dinero";
import { describirPeriodo, formatearFecha } from "@/lib/fechas";
import { formatearDni } from "@/lib/texto";
import { useGuardarSocio } from "./hooks";
import {
  buscarDuplicados,
  crearEsquemaSocio,
  FORMULARIO_SOCIO_VACIO,
  nombreCompleto,
  socioAFormulario,
  type DatosSocio,
  type FormularioSocio,
  type Socio,
} from "./logica/socio";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  /** null = socio nuevo. */
  socio: Socio | null;
  /** Todos los socios, para detectar duplicados. */
  socios: Socio[];
  /** Se llama con el id del socio guardado. */
  alGuardar?: (id: number) => void;
}

export function FormularioSocioDialogo({ abierto, alCerrar, socio, socios, alGuardar }: Props) {
  const config = useConfig();
  const planes = usePlanes();
  const guardar = useGuardarSocio();
  const esquema = useMemo(() => crearEsquemaSocio(config.data?.codigo_area ?? ""), [config.data?.codigo_area]);
  // Socios con el mismo nombre que el usuario ya vio y aceptó guardar igual.
  const [duplicadosAceptados, setDuplicadosAceptados] = useState<Socio[] | null>(null);
  const avisoDuplicados = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset, setError, control, formState, getValues, setValue } = useForm<FormularioSocio, unknown, DatosSocio>({
    resolver: zodResolver(esquema),
    defaultValues: FORMULARIO_SOCIO_VACIO,
  });
  const e = formState.errors;

  const opcionesPlan = planesElegibles(planes.data ?? [], socio?.planId ?? null);
  const planPorDefecto = opcionesPlan.find((p) => p.activo && p.periodo === "mes" && p.cantidad === 1) ?? opcionesPlan[0];

  const cerrar = () => {
    setDuplicadosAceptados(null);
    alCerrar();
  };

  // El objeto `socio` se recrea en cada recálculo del listado (refetch, cambio de día):
  // el formulario se reinicia solo al abrir o al cambiar de socio, no por eso,
  // para no borrar lo que el usuario está escribiendo.
  const socioActual = useRef(socio);
  useEffect(() => {
    socioActual.current = socio;
  });
  const idSocio = socio?.id ?? null;
  useEffect(() => {
    if (!abierto) return;
    const s = socioActual.current;
    reset(s ? socioAFormulario(s) : FORMULARIO_SOCIO_VACIO);
  }, [abierto, idSocio, reset]);

  // Socio nuevo: proponer el plan mensual en cuanto los planes estén cargados.
  const idPlanPorDefecto = planPorDefecto?.id;
  useEffect(() => {
    if (abierto && idSocio === null && idPlanPorDefecto !== undefined && getValues("planId") === "") {
      setValue("planId", String(idPlanPorDefecto));
    }
  }, [abierto, idSocio, idPlanPorDefecto, getValues, setValue]);

  // Que la advertencia de duplicados quede a la vista aunque el diálogo tenga scroll.
  useEffect(() => {
    if (duplicadosAceptados?.length) avisoDuplicados.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [duplicadosAceptados]);

  const enviar = handleSubmit(async (datos) => {
    const { mismoDni, mismoNombre } = buscarDuplicados(datos, socios, socio?.id);
    if (mismoDni) {
      setError("dni", {
        message: `Ese DNI ya es de ${nombreCompleto(mismoDni)}${mismoDni.activo ? "" : " (dado de baja)"}`,
      });
      return;
    }
    if (mismoNombre.length > 0 && duplicadosAceptados === null) {
      setDuplicadosAceptados(mismoNombre); // se muestra la advertencia; el próximo envío guarda igual
      return;
    }
    try {
      const id = await guardar.mutateAsync({ id: socio?.id ?? null, datos });
      avisar.exito(socio ? "Datos del socio actualizados" : "Socio agregado", {
        descripcion: nombreCompleto(datos),
      });
      cerrar();
      if (id !== null) alGuardar?.(id);
    } catch (error) {
      avisar.error("No se pudo guardar el socio", error);
    }
  });

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && cerrar()}>
      {/* Altura acotada para alejar el pie (con los botones) de la esquina donde aparecen los avisos. */}
      <DialogContent className="max-h-[calc(100vh-14rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{socio ? "Editar socio" : "Nuevo socio"}</DialogTitle>
          <DialogDescription className="text-base">
            Los campos con <span className="text-destructive">*</span> son obligatorios.
          </DialogDescription>
        </DialogHeader>

        {duplicadosAceptados && duplicadosAceptados.length > 0 && (
          <div
            ref={avisoDuplicados}
            role="alert"
            className="flex gap-3 rounded-xl border-2 border-amber-600/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100"
          >
            <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="space-y-2">
              <p className="font-semibold">
                Ya hay {duplicadosAceptados.length === 1 ? "un socio" : "socios"} con el mismo nombre:
              </p>
              <ul className="list-disc pl-5">
                {duplicadosAceptados.map((d) => (
                  <li key={d.id}>
                    <strong>{nombreCompleto(d)}</strong>
                    {d.dni ? ` · DNI ${formatearDni(d.dni)}` : " · sin DNI"}
                    {` · socio desde ${formatearFecha(d.fechaAlta)}`}
                    {d.activo ? "" : " · dado de baja"}
                  </li>
                ))}
              </ul>
              <p>Si es otra persona, tocá "Guardar igual". Si es la misma, tocá "Cancelar" y buscala en el listado.</p>
            </div>
          </div>
        )}

        <form id="form-socio" onSubmit={enviar} noValidate className="grid gap-4 md:grid-cols-2">
          <Campo id="socio-nombre" etiqueta="Nombre" obligatorio error={e.nombre?.message}>
            <Input
              id="socio-nombre"
              autoFocus
              autoComplete="off"
              aria-invalid={!!e.nombre}
              aria-describedby={idsDescripcion("socio-nombre", e.nombre?.message)}
              {...register("nombre", { onChange: () => setDuplicadosAceptados(null) })}
            />
          </Campo>
          <Campo id="socio-apellido" etiqueta="Apellido" obligatorio error={e.apellido?.message}>
            <Input
              id="socio-apellido"
              autoComplete="off"
              aria-invalid={!!e.apellido}
              aria-describedby={idsDescripcion("socio-apellido", e.apellido?.message)}
              {...register("apellido", { onChange: () => setDuplicadosAceptados(null) })}
            />
          </Campo>
          <Campo id="socio-dni" etiqueta="DNI" ayuda="Con o sin puntos" error={e.dni?.message}>
            <Input
              id="socio-dni"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={!!e.dni}
              aria-describedby={idsDescripcion("socio-dni", e.dni?.message, true)}
              {...register("dni")}
            />
          </Campo>
          <Campo
            id="socio-telefono"
            etiqueta="Teléfono (WhatsApp)"
            ayuda={`Celular. Si no ponés código de área se usa ${config.data?.codigo_area || "el configurado"}.`}
            error={e.telefono?.message}
          >
            <Input
              id="socio-telefono"
              inputMode="tel"
              autoComplete="off"
              placeholder="Ej.: 3482 15 123456"
              aria-invalid={!!e.telefono}
              aria-describedby={idsDescripcion("socio-telefono", e.telefono?.message, true)}
              {...register("telefono")}
            />
          </Campo>
          <Campo id="socio-email" etiqueta="Email" error={e.email?.message}>
            <Input
              id="socio-email"
              type="email"
              autoComplete="off"
              aria-invalid={!!e.email}
              aria-describedby={idsDescripcion("socio-email", e.email?.message)}
              {...register("email")}
            />
          </Campo>
          <Campo
            id="socio-plan"
            etiqueta="Plan"
            obligatorio
            ayuda={socio ? "Si cambiás el plan, se aplica desde el próximo pago." : undefined}
            error={e.planId?.message}
          >
            <Controller
              control={control}
              name="planId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="socio-plan"
                    className="w-full"
                    aria-invalid={!!e.planId}
                    aria-describedby={idsDescripcion("socio-plan", e.planId?.message, !!socio)}
                  >
                    <SelectValue placeholder="Elegí un plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcionesPlan.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre} · {p.monto > 0 ? formatearPesos(p.monto) : "sin precio"} ·{" "}
                        {describirPeriodo(p.periodo, p.cantidad)}
                        {p.activo ? "" : " (inactivo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!planes.isPending && opcionesPlan.length === 0 && (
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                No hay planes activos.{" "}
                <Link to="/planes" className="underline" onClick={cerrar}>
                  Crear un plan
                </Link>
              </p>
            )}
          </Campo>
          <div className="md:col-span-2">
            <Campo id="socio-notas" etiqueta="Notas" error={e.notas?.message}>
              <Textarea id="socio-notas" rows={3} {...register("notas")} />
            </Campo>
          </div>

        </form>

        <DialogFooter className="sticky bottom-0 items-center bg-popover">
          {config.isPending && <p className="mr-auto min-w-0 flex-1 text-muted-foreground">Cargando configuración…</p>}
          {config.error && <p className="mr-auto min-w-0 flex-1 font-medium text-destructive">No se pudo cargar la configuración. Cerrá y volvé a abrir.</p>}
          <Button variant="outline" onClick={cerrar} disabled={formState.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="form-socio" disabled={formState.isSubmitting || !config.data}>
            {formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {duplicadosAceptados && duplicadosAceptados.length > 0
              ? "Guardar igual"
              : socio
                ? "Guardar cambios"
                : "Agregar socio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
