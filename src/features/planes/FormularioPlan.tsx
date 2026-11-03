import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Campo, idsDescripcion } from "@/components/Campo";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { centavosATexto, formatearPesos } from "@/lib/dinero";
import { describirPeriodo } from "@/lib/fechas";
import { useGuardarPlan } from "./hooks";
import { esquemaPlan, nombreDePlanRepetido, PERIODOS, type DatosPlan, type FormularioPlan, type Plan } from "./logica/plan";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  /** null = plan nuevo. */
  plan: Plan | null;
  planes: Plan[];
}

const VACIO: FormularioPlan = { nombre: "", periodo: "mes", cantidad: "1", monto: "" };

export function FormularioPlanDialogo({ abierto, alCerrar, plan, planes }: Props) {
  const guardar = useGuardarPlan();
  const form = useForm<FormularioPlan, unknown, DatosPlan>({
    resolver: zodResolver(esquemaPlan),
    defaultValues: VACIO,
  });
  const { register, handleSubmit, reset, setError, watch, control, formState } = form;
  const e = formState.errors;

  useEffect(() => {
    if (!abierto) return;
    reset(
      plan
        ? { nombre: plan.nombre, periodo: plan.periodo, cantidad: String(plan.cantidad), monto: centavosATexto(plan.monto) }
        : VACIO,
    );
  }, [abierto, plan, reset]);

  const enviar = handleSubmit(async (datos) => {
    if (nombreDePlanRepetido(datos.nombre, planes, plan?.id)) {
      setError("nombre", { message: "Ya hay un plan con ese nombre" });
      return;
    }
    try {
      await guardar.mutateAsync({ id: plan?.id ?? null, datos });
      avisar.exito(plan ? "Plan actualizado" : "Plan creado", {
        descripcion: `${datos.nombre}: ${formatearPesos(datos.monto)} cada ${describirPeriodo(datos.periodo, datos.cantidad)}`,
      });
      alCerrar();
    } catch (error) {
      avisar.error("No se pudo guardar el plan", error);
    }
  });

  const cantidad = Number(watch("cantidad")) || 1;

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription className="text-base">
            {plan
              ? "Si cambiás el precio, los pagos ya registrados no se modifican."
              : "Definí cada cuánto se paga y cuánto cuesta."}
          </DialogDescription>
        </DialogHeader>

        <form id="form-plan" onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <Campo id="plan-nombre" etiqueta="Nombre" obligatorio error={e.nombre?.message}>
            <Input
              id="plan-nombre"
              autoFocus
              placeholder="Ej.: Mensual, Trimestral, Pase diario"
              aria-invalid={!!e.nombre}
              aria-describedby={idsDescripcion("plan-nombre", e.nombre?.message)}
              {...register("nombre")}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo id="plan-cantidad" etiqueta="Cada" obligatorio error={e.cantidad?.message}>
              <Input
                id="plan-cantidad"
                inputMode="numeric"
                aria-invalid={!!e.cantidad}
                aria-describedby={idsDescripcion("plan-cantidad", e.cantidad?.message)}
                {...register("cantidad")}
              />
            </Campo>
            <Campo id="plan-periodo" etiqueta="Período" obligatorio error={e.periodo?.message}>
              <Controller
                control={control}
                name="periodo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="plan-periodo" className="w-full" aria-invalid={!!e.periodo}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODOS.map((p) => (
                        <SelectItem key={p.valor} value={p.valor}>
                          {describirPeriodo(p.valor, cantidad).replace(/^\d+ /, "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Campo>
          </div>

          <Campo
            id="plan-monto"
            etiqueta="Precio"
            obligatorio
            ayuda="En pesos. Ej.: 25000 o 25.000"
            error={e.monto?.message}
          >
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="plan-monto"
                inputMode="decimal"
                className="pl-7"
                aria-invalid={!!e.monto}
                aria-describedby={idsDescripcion("plan-monto", e.monto?.message, true)}
                {...register("monto")}
              />
            </div>
          </Campo>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={alCerrar} disabled={formState.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="form-plan" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
            {plan ? "Guardar cambios" : "Crear plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
