import { useRef, useState } from "react";
import { CircleCheck, CircleOff, Ellipsis, Pencil, Plus, PowerOff, RotateCcw, Tags, Trash2, TriangleAlert } from "lucide-react";
import { Confirmar, type AccionConfirmar } from "@/components/Confirmar";
import { Cargando, ErrorCarga, Vacio } from "@/components/EstadosCarga";
import { Pagina } from "@/components/layout/Pagina";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usoDelPlan } from "@/db/queries/planes";
import { formatearPesos } from "@/lib/dinero";
import { describirPeriodo } from "@/lib/fechas";
import { FormularioPlanDialogo } from "./FormularioPlan";
import { useCambiarActivoPlan, useEliminarPlan, usePlanes } from "./hooks";
import { puedeEliminarPlan, type Plan, type ResultadoEliminar, type UsoDelPlan } from "./logica/plan";

export function PaginaPlanes() {
  const planes = usePlanes();
  const cambiarActivo = useCambiarActivoPlan();
  const eliminar = useEliminarPlan();
  const [editando, setEditando] = useState<{ plan: Plan | null } | null>(null);
  // Los datos de cada diálogo se conservan al cerrarlo (solo cambia `abierto`), para que
  // el contenido no se vacíe durante la animación de cierre.
  const [desactivar, setDesactivar] = useState<{ abierto: boolean; plan: Plan; uso: UsoDelPlan } | null>(null);
  const [borrar, setBorrar] = useState<{
    abierto: boolean;
    plan: Plan;
    resultado: ResultadoEliminar;
    eliminado?: boolean;
  } | null>(null);
  const cerrarDesactivar = () => setDesactivar((d) => d && { ...d, abierto: false });
  const cerrarBorrar = () => setBorrar((d) => d && { ...d, abierto: false });

  // Al cerrar un diálogo, el foco vuelve al botón "⋯" de la fila (o a "Nuevo plan" si el plan se eliminó).
  const disparador = useRef<HTMLElement | null>(null);
  const botonNuevo = useRef<HTMLButtonElement>(null);

  const pedirDesactivar = async (plan: Plan) => {
    try {
      setDesactivar({ abierto: true, plan, uso: await usoDelPlan(plan.id) });
    } catch (e) {
      avisar.error("No se pudo consultar el plan", e);
    }
  };

  const pedirEliminar = async (plan: Plan) => {
    try {
      setBorrar({ abierto: true, plan, resultado: puedeEliminarPlan(await usoDelPlan(plan.id)) });
    } catch (e) {
      avisar.error("No se pudo consultar el plan", e);
    }
  };

  const aplicarActivo = async (plan: Plan, activo: boolean) => {
    try {
      await cambiarActivo.mutateAsync({ id: plan.id, activo });
      avisar.exito(activo ? `Plan "${plan.nombre}" reactivado` : `Plan "${plan.nombre}" desactivado`);
      cerrarDesactivar();
      cerrarBorrar();
    } catch (e) {
      avisar.error("No se pudo cambiar el plan", e);
    }
  };

  const aplicarEliminar = async (plan: Plan) => {
    try {
      await eliminar.mutateAsync(plan.id);
      avisar.exito(`Plan "${plan.nombre}" eliminado`);
      // La fila (y su botón "⋯") desaparece: el foco va a "Nuevo plan".
      setBorrar((d) => d && { ...d, abierto: false, eliminado: true });
    } catch (e) {
      avisar.error("No se pudo eliminar el plan", e);
    }
  };

  return (
    <Pagina
      titulo="Planes"
      descripcion="Cada plan define cada cuánto paga el socio y cuánto cuesta."
      acciones={
        <Button ref={botonNuevo} size="lg" onClick={() => setEditando({ plan: null })}>
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
                    {/* "Editar" a la vista; las acciones menos frecuentes (y la irreversible) en un menú,
                        para que no estén pegadas y no se toquen por error. */}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" aria-label={`Editar plan ${p.nombre}`} onClick={() => setEditando({ plan: p })}>
                        <Pencil aria-hidden /> Editar
                      </Button>
                      {/* modal={false}: el menú abre diálogos; así no quedan dos capas modales peleando por el foco. */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={`Más acciones para el plan ${p.nombre}`}
                            onClick={(e) => (disparador.current = e.currentTarget)}
                          >
                            <Ellipsis aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-52">
                          {p.activo ? (
                            <DropdownMenuItem className="py-2.5 text-base" onSelect={() => void pedirDesactivar(p)}>
                              <PowerOff aria-hidden className="size-5" /> Desactivar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="py-2.5 text-base" onSelect={() => void aplicarActivo(p, true)}>
                              <RotateCcw aria-hidden className="size-5" /> Reactivar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            className="py-2.5 text-base text-red-700 focus:text-red-800 dark:text-red-400 dark:focus:text-red-300 [&_svg]:!text-current"
                            onSelect={() => void pedirEliminar(p)}
                          >
                            <Trash2 aria-hidden className="size-5" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        abierto={desactivar?.abierto ?? false}
        alCambiar={(a) => !a && cerrarDesactivar()}
        titulo={`¿Desactivar el plan "${desactivar?.plan.nombre ?? ""}"?`}
        descripcion={
          desactivar && desactivar.uso.sociosActivos > 0
            ? `${desactivar.uso.sociosActivos === 1 ? "1 socio activo tiene" : `${desactivar.uso.sociosActivos} socios activos tienen`} este plan y lo van a conservar. Los socios nuevos ya no podrán elegirlo. Podés reactivarlo cuando quieras.`
            : "Los socios nuevos ya no podrán elegirlo. Podés reactivarlo cuando quieras."
        }
        accion={
          desactivar
            ? { texto: "Desactivar", peligroso: true, alConfirmar: () => void aplicarActivo(desactivar.plan, false) }
            : undefined
        }
        procesando={cambiarActivo.isPending}
        focoAlCerrar={disparador}
      />

      {/* Un solo diálogo, siempre montado: cambia el contenido según se pueda eliminar o no. */}
      <Confirmar
        abierto={borrar?.abierto ?? false}
        alCambiar={(a) => !a && cerrarBorrar()}
        procesando={eliminar.isPending || cambiarActivo.isPending}
        focoAlCerrar={borrar?.eliminado ? botonNuevo : disparador}
        {...propsDialogoEliminar(borrar, {
          eliminar: (plan) => void aplicarEliminar(plan),
          desactivar: (plan) => void aplicarActivo(plan, false),
        })}
      />
    </Pagina>
  );
}

interface AccionesEliminar {
  eliminar: (plan: Plan) => void;
  desactivar: (plan: Plan) => void;
}

interface PropsEliminar {
  titulo: string;
  descripcion: string;
  accion?: AccionConfirmar;
  textoCancelar?: string;
}

/** Textos y acción del diálogo de eliminar, según el plan se pueda borrar o no. */
function propsDialogoEliminar(
  estado: { plan: Plan; resultado: ResultadoEliminar } | null,
  acciones: AccionesEliminar,
): PropsEliminar {
  if (!estado) return { titulo: "", descripcion: "" };
  const { plan, resultado } = estado;
  if (resultado.puede) {
    return {
      titulo: `¿Eliminar el plan "${plan.nombre}"?`,
      descripcion: "Este plan nunca se usó, así que se puede borrar. Esta acción no se puede deshacer.",
      accion: { texto: "Eliminar", peligroso: true, alConfirmar: () => acciones.eliminar(plan) },
    };
  }
  const titulo = `No se puede eliminar "${plan.nombre}"`;
  if (!plan.activo) {
    return {
      titulo,
      textoCancelar: "Cerrar",
      descripcion: `${resultado.motivo} Así se conserva el historial de pagos. El plan ya está desactivado.`,
    };
  }
  return {
    titulo,
    textoCancelar: "Cerrar",
    descripcion: `${resultado.motivo} Así se conserva el historial de pagos. Podés desactivarlo: los socios que ya lo tienen lo conservan, pero los nuevos no podrán elegirlo.`,
    accion: { texto: "Desactivar plan", alConfirmar: () => acciones.desactivar(plan) },
  };
}
