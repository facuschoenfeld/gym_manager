import { useState } from "react";
import { CircleCheck, CircleOff, Pencil, Plus, PowerOff, RotateCcw, Tags, TriangleAlert } from "lucide-react";
import { Confirmar } from "@/components/Confirmar";
import { Cargando, ErrorCarga, Vacio } from "@/components/EstadosCarga";
import { Pagina } from "@/components/layout/Pagina";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contarSociosConPlan } from "@/db/queries/planes";
import { formatearPesos } from "@/lib/dinero";
import { describirPeriodo } from "@/lib/fechas";
import { FormularioPlanDialogo } from "./FormularioPlan";
import { useCambiarActivoPlan, usePlanes } from "./hooks";
import type { Plan } from "./logica/plan";

export function PaginaPlanes() {
  const planes = usePlanes();
  const cambiarActivo = useCambiarActivoPlan();
  const [editando, setEditando] = useState<{ plan: Plan | null } | null>(null);
  const [aDesactivar, setADesactivar] = useState<{ plan: Plan; socios: number } | null>(null);

  const pedirDesactivar = async (plan: Plan) => {
    try {
      setADesactivar({ plan, socios: await contarSociosConPlan(plan.id) });
    } catch (e) {
      avisar.error("No se pudo consultar el plan", e);
    }
  };

  const aplicarActivo = async (plan: Plan, activo: boolean) => {
    try {
      await cambiarActivo.mutateAsync({ id: plan.id, activo });
      avisar.exito(activo ? `Plan "${plan.nombre}" reactivado` : `Plan "${plan.nombre}" desactivado`, {
        accion: {
          etiqueta: "Deshacer",
          alHacerClic: () =>
            void cambiarActivo
              .mutateAsync({ id: plan.id, activo: !activo })
              .catch((e: unknown) => avisar.error("No se pudo deshacer", e)),
        },
      });
      setADesactivar(null);
    } catch (e) {
      avisar.error("No se pudo cambiar el plan", e);
    }
  };

  return (
    <Pagina
      titulo="Planes"
      descripcion="Cada plan define cada cuánto paga el socio y cuánto cuesta."
      acciones={
        <Button size="lg" onClick={() => setEditando({ plan: null })}>
          <Plus aria-hidden /> Nuevo plan
        </Button>
      }
    >
      {planes.isPending && <Cargando texto="Cargando planes…" />}
      {planes.error && <ErrorCarga error={planes.error} reintentar={() => void planes.refetch()} />}
      {planes.data?.length === 0 && (
        <Vacio
          icono={Tags}
          titulo="Todavía no hay planes"
          descripcion="Creá al menos un plan para poder asignarlo a los socios."
          accion={<Button size="lg" onClick={() => setEditando({ plan: null })}>Crear el primer plan</Button>}
        />
      )}
      {planes.data && planes.data.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Se paga cada</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planes.data.map((p) => (
                <TableRow key={p.id} className={p.activo ? "" : "text-muted-foreground"}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{describirPeriodo(p.periodo, p.cantidad)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.monto === 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                        <TriangleAlert className="size-4" aria-hidden /> Sin precio
                      </span>
                    ) : (
                      formatearPesos(p.monto)
                    )}
                  </TableCell>
                  <TableCell>
                    {p.activo ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CircleCheck className="size-4 text-green-700 dark:text-green-400" aria-hidden /> Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <CircleOff className="size-4" aria-hidden /> Inactivo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" aria-label={`Editar plan ${p.nombre}`} onClick={() => setEditando({ plan: p })}>
                        <Pencil aria-hidden /> Editar
                      </Button>
                      {p.activo ? (
                        <Button variant="outline" aria-label={`Desactivar plan ${p.nombre}`} onClick={() => void pedirDesactivar(p)}>
                          <PowerOff aria-hidden /> Desactivar
                        </Button>
                      ) : (
                        <Button variant="outline" aria-label={`Reactivar plan ${p.nombre}`} onClick={() => void aplicarActivo(p, true)}>
                          <RotateCcw aria-hidden /> Reactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FormularioPlanDialogo
        abierto={editando !== null}
        plan={editando?.plan ?? null}
        planes={planes.data ?? []}
        alCerrar={() => setEditando(null)}
      />

      <Confirmar
        abierto={aDesactivar !== null}
        alCambiar={(a) => !a && setADesactivar(null)}
        titulo={`¿Desactivar el plan "${aDesactivar?.plan.nombre ?? ""}"?`}
        descripcion={
          aDesactivar && aDesactivar.socios > 0
            ? `${aDesactivar.socios} socio(s) activo(s) tienen este plan y lo van a conservar. Los socios nuevos ya no podrán elegirlo. Podés reactivarlo cuando quieras.`
            : "Los socios nuevos ya no podrán elegirlo. Podés reactivarlo cuando quieras."
        }
        textoConfirmar="Desactivar"
        peligroso
        procesando={cambiarActivo.isPending}
        alConfirmar={() => aDesactivar && void aplicarActivo(aDesactivar.plan, false)}
      />
    </Pagina>
  );
}
