import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import { CalendarClock, CircleAlert, Loader2, TriangleAlert } from "lucide-react";
import { Campo, idsDescripcion } from "@/components/Campo";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfig } from "@/features/configuracion/hooks";
import { usePlanes } from "@/features/planes/hooks";
import { planesElegibles } from "@/features/planes/logica/plan";
import type { Pago } from "@/db/queries/pagos";
import { usePagosDeSocio } from "@/features/socios/hooks";
import { nombreCompleto, type Socio } from "@/features/socios/logica/socio";
import { centavosATexto, formatearPesos, parsearPesos } from "@/lib/dinero";
import { describirPeriodo, esFechaISOValida, formatearFecha, hoyISO, type FechaISO } from "@/lib/fechas";
import { calcularNuevoVencimiento, inicioDelPeriodo } from "@/lib/vencimiento";
import { useRegistrarPago } from "./hooks";
import {
  crearEsquemaPago,
  FORMULARIO_PAGO_VACIO,
  MEDIOS_PAGO,
  pagoDelMismoDia,
  planPorDefectoParaPago,
  type DatosPagoForm,
  type FormularioPago,
} from "./logica/pago";

/** Mensaje accionable: dice qué pago hay y cómo corregirlo (el historial queda detrás del diálogo). */
const mensajeMismoDia = (p: Pago) =>
  `Ya hay un pago de ${formatearPesos(p.monto)} registrado el ${formatearFecha(p.fechaPago)}. Si está mal, cerrá esta ventana y anulalo desde el historial del socio.`;

interface Props {
  socio: Socio;
  alCerrar: () => void;
}

/**
 * Registro de un pago (F-PAG-01 a F-PAG-03). Se monta al abrirlo, así que cada vez arranca limpio.
 * El plan y el monto vienen precargados; el nuevo vencimiento se muestra antes de confirmar.
 */
export function RegistrarPagoDialogo({ socio, alCerrar }: Props) {
  const config = useConfig();
  const planes = usePlanes();
  const registrar = useRegistrarPago();
  const pagosSocio = usePagosDeSocio(socio.id);
  const hoy = hoyISO();
  const esquema = useMemo(() => crearEsquemaPago(hoy), [hoy]);

  const { register, handleSubmit, control, setValue, getValues, setError, setFocus, formState } = useForm<
    FormularioPago,
    unknown,
    DatosPagoForm
  >({
    resolver: zodResolver(esquema),
    defaultValues: { ...FORMULARIO_PAGO_VACIO, fechaPago: hoy },
  });
  const e = formState.errors;

  const opciones = planesElegibles(planes.data ?? [], socio.planId);
  const planPropuesto = planPorDefectoParaPago(planes.data ?? [], socio.planId);
  const planPropuestoId = planPropuesto?.id;
  const planPropuestoMonto = planPropuesto?.monto;

  // Al abrir, o cuando llegan los planes, se propone el plan y su precio. Solo si el plan
  // todavía está vacío: no se pisa lo que el usuario ya eligió o escribió.
  useEffect(() => {
    if (planPropuestoId === undefined || planPropuestoMonto === undefined) return;
    if (getValues("planId") !== "") return;
    setValue("planId", String(planPropuestoId));
    setValue("monto", centavosATexto(planPropuestoMonto));
  }, [planPropuestoId, planPropuestoMonto, getValues, setValue]);

  const alElegirPlan = (id: string, cambiar: (valor: string) => void) => {
    cambiar(id);
    // Cambiar de plan cambia el precio propuesto. El usuario puede corregirlo después.
    const plan = opciones.find((p) => String(p.id) === id);
    if (plan) setValue("monto", centavosATexto(plan.monto), { shouldDirty: true });
  };

  // Vista previa del nuevo vencimiento, con la misma regla que se usa al guardar.
  const planId = useWatch({ control, name: "planId" });
  const fechaPago = useWatch({ control, name: "fechaPago" });
  const montoTexto = useWatch({ control, name: "monto" });
  const planElegido = opciones.find((p) => String(p.id) === planId);
  const sinCobro = parsearPesos(montoTexto ?? "") === 0;
  // Regla: un solo pago vigente por socio y por día.
  const pagoDelDia = pagoDelMismoDia(pagosSocio.data ?? [], fechaPago);
  const errorFecha = e.fechaPago?.message ?? (pagoDelDia ? mensajeMismoDia(pagoDelDia) : undefined);
  const vista = (() => {
    if (!planElegido || !config.data || !esFechaISOValida(fechaPago) || fechaPago > hoy) return null;
    const base = {
      regla: config.data.regla_vencimiento,
      fechaPago,
      venceElAnterior: socio.venceEl,
      diasGracia: config.data.dias_gracia,
    };
    return {
      desde: inicioDelPeriodo(base),
      hasta: calcularNuevoVencimiento({ ...base, periodo: planElegido.periodo, cantidad: planElegido.cantidad }),
    };
  })();

  const enviar = handleSubmit(async (datos) => {
    const repetido = pagoDelMismoDia(pagosSocio.data ?? [], datos.fechaPago);
    if (repetido) {
      setError("fechaPago", { message: mensajeMismoDia(repetido) });
      setFocus("fechaPago");
      return;
    }
    const plan = opciones.find((p) => p.id === datos.planId);
    if (!plan) {
      setError("planId", { message: "Ese plan ya no está disponible. Elegí otro." });
      return;
    }
    if (!config.data) return;
    const venceEl: FechaISO = calcularNuevoVencimiento({
      regla: config.data.regla_vencimiento,
      fechaPago: datos.fechaPago,
      venceElAnterior: socio.venceEl,
      periodo: plan.periodo,
      cantidad: plan.cantidad,
      diasGracia: config.data.dias_gracia,
    });
    try {
      await registrar.mutateAsync({
        socioId: socio.id,
        planId: plan.id,
        monto: datos.monto,
        fechaPago: datos.fechaPago,
        venceEl,
        medio: datos.medio,
        referencia: datos.referencia,
      });
      avisar.exito("Pago registrado", {
        descripcion: `${nombreCompleto(socio)} · ${formatearPesos(datos.monto)} · vence el ${formatearFecha(venceEl)}`,
      });
      alCerrar();
    } catch (error) {
      avisar.error("No se pudo registrar el pago", error);
    }
  });

  const cargando = planes.isPending || config.isPending;
  const sinPlanes = !planes.isPending && opciones.length === 0;
  const errorCarga = planes.error ?? config.error ?? pagosSocio.error;

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !registrar.isPending && alCerrar()}>
      {/* Altura acotada para que el pie quede lejos de la esquina donde aparecen los avisos. */}
      <DialogContent className="max-h-[calc(100vh-14rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Registrar pago</DialogTitle>
          <DialogDescription className="text-base">
            {nombreCompleto(socio)}. Los campos con <span className="text-destructive">*</span> son obligatorios.
          </DialogDescription>
        </DialogHeader>

        {errorCarga && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-destructive/60 p-4">
            <CircleAlert className="size-6 shrink-0 text-destructive" aria-hidden />
            <p className="mr-auto font-medium">No se pudieron cargar los datos necesarios para cobrar.</p>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                void planes.refetch();
                void config.refetch();
                void pagosSocio.refetch();
              }}
            >
              Reintentar
            </Button>
          </div>
        )}

        {sinPlanes && (
          <div role="alert" className="flex gap-3 rounded-xl border-2 border-amber-600/60 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <TriangleAlert className="mt-0.5 size-6 shrink-0" aria-hidden />
            <p className="text-base">
              No hay planes disponibles para cobrar.{" "}
              <Link to="/planes" className="font-semibold underline" onClick={alCerrar}>
                Crear o activar un plan
              </Link>
            </p>
          </div>
        )}

        <form id="form-pago" onSubmit={enviar} noValidate className="grid gap-4 md:grid-cols-2">
          <Campo id="pago-plan" etiqueta="Plan" obligatorio error={e.planId?.message}>
            <Controller
              control={control}
              name="planId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => alElegirPlan(v, field.onChange)}>
                  <SelectTrigger
                    id="pago-plan"
                    ref={field.ref}
                    className="w-full"
                    aria-invalid={!!e.planId}
                    aria-describedby={idsDescripcion("pago-plan", e.planId?.message)}
                  >
                    <SelectValue placeholder={cargando ? "Cargando planes…" : "Elegí un plan"} />
                  </SelectTrigger>
                  <SelectContent>
                    {opciones.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre} · {describirPeriodo(p.periodo, p.cantidad)}
                        {p.activo ? "" : " (inactivo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <Campo
            id="pago-monto"
            etiqueta="Monto"
            obligatorio
            ayuda="Viene del precio del plan. Cambialo si cobraste otro monto (por ejemplo, con descuento). Poné 0 si no se cobra."
            error={e.monto?.message}
          >
            <Input
              id="pago-monto"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!!e.monto}
              aria-describedby={idsDescripcion("pago-monto", e.monto?.message, true)}
              {...register("monto")}
            />
          </Campo>

          <Campo id="pago-fecha" etiqueta="Fecha de pago" obligatorio ayuda="No puede ser futura." error={errorFecha}>
            <Input
              id="pago-fecha"
              type="date"
              max={hoy}
              aria-invalid={!!errorFecha}
              aria-describedby={idsDescripcion("pago-fecha", errorFecha, true)}
              {...register("fechaPago")}
            />
          </Campo>

          <Campo id="pago-medio" etiqueta="Medio de pago" obligatorio error={e.medio?.message}>
            <Controller
              control={control}
              name="medio"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="pago-medio"
                    ref={field.ref}
                    className="w-full"
                    aria-invalid={!!e.medio}
                    aria-describedby={idsDescripcion("pago-medio", e.medio?.message)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIOS_PAGO.map((m) => (
                      <SelectItem key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Campo>

          <div className="md:col-span-2">
            <Campo
              id="pago-referencia"
              etiqueta="Referencia"
              ayuda="N.º de operación o una nota. Sirve para encontrar una transferencia después."
              error={e.referencia?.message}
            >
              <Input
                id="pago-referencia"
                autoComplete="off"
                aria-invalid={!!e.referencia}
                aria-describedby={idsDescripcion("pago-referencia", e.referencia?.message, true)}
                {...register("referencia")}
              />
            </Campo>
          </div>

          <div className="rounded-xl border-2 bg-muted/40 p-4 md:col-span-2" aria-live="polite">
            {vista ? (
              <>
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <CalendarClock className="size-6" aria-hidden />
                  Nuevo vencimiento: {formatearFecha(vista.hasta)}
                </p>
                <p className="text-base text-muted-foreground">
                  Cuenta desde el {formatearFecha(vista.desde)}
                  {planElegido ? ` · ${describirPeriodo(planElegido.periodo, planElegido.cantidad)}` : ""}
                </p>
              </>
            ) : (
              <p className="text-base text-muted-foreground">Elegí un plan y una fecha para ver el nuevo vencimiento.</p>
            )}
            {sinCobro && (
              <p className="mt-3 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-300">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Monto $ 0: el pago se registra sin cobro.
              </p>
            )}
          </div>
        </form>

        <DialogFooter className="sticky bottom-0 items-center bg-popover">
          <Button type="button" variant="outline" size="lg" onClick={alCerrar} disabled={registrar.isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-pago"
            size="lg"
            disabled={formState.isSubmitting || registrar.isPending || cargando || pagosSocio.isPending || !config.data || sinPlanes || !!errorCarga}
          >
            {registrar.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
