import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { ChevronRight, CreditCard, Plus, Search, UserPlus, Users, X } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/EstadosCarga";
import { Pagina } from "@/components/layout/Pagina";
import type { EstadoNavegacion } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlanes } from "@/features/planes/hooks";
import { RegistrarPagoDialogo } from "@/features/pagos/RegistrarPagoDialogo";
import { describirVencimiento, type EstadoSocio } from "@/lib/estado";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { formatearTelefono } from "@/lib/telefonos";
import { formatearDni } from "@/lib/texto";
import { cn } from "@/lib/utils";
import { EstadoBadge, VISUAL_ESTADO } from "./componentes/EstadoBadge";
import { FormularioSocioDialogo } from "./FormularioSocio";
import { useSocios } from "./hooks";
import {
  contarParaFiltros,
  FILTROS_INICIALES,
  filtrarSocios,
  leerFiltrosGuardados,
  nombreCompleto,
  type FiltroActivo,
  type FiltrosSocios,
  type OrdenSocios,
  type SocioConEstado,
} from "./logica/socio";

// Los filtros sobreviven al ir a la ficha de un socio y volver.
const CLAVE_FILTROS = "gym-manager:filtros-socios";
const filtrosGuardados = (): FiltrosSocios => leerFiltrosGuardados(sessionStorage.getItem(CLAVE_FILTROS));

const ESTADOS_FILTRO: EstadoSocio[] = ["vencido", "por_vencer", "pago", "sin_pagos"];

/** Columnas secundarias que se ocultan en ventanas angostas (menos de 1280 px). */
const SOLO_PANTALLA_ANCHA = new Set(["planNombre", "telefono"]);

// TanStack Table v9: las features y el helper van a nivel de módulo (entradas estables).
const features = tableFeatures({});
const col = createColumnHelper<typeof features, SocioConEstado>();

export function PaginaSocios() {
  const socios = useSocios();
  const planes = usePlanes();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const buscador = useRef<HTMLInputElement>(null);
  const [filtros, setFiltros] = useState<FiltrosSocios>(filtrosGuardados);
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  // Se guarda el id, no el socio: así el diálogo siempre usa los datos actuales de la lista.
  const [pagarAId, setPagarAId] = useState<number | null>(null);
  const pagarA = pagarAId === null ? null : (socios.data?.find((s) => s.id === pagarAId) ?? null);
  const hoy = hoyISO();

  useEffect(() => sessionStorage.setItem(CLAVE_FILTROS, JSON.stringify(filtros)), [filtros]);

  // Atajos globales (Ctrl+F, Ctrl+N) llegan como estado de navegación.
  const accionPedida = (ubicacion.state as EstadoNavegacion | null)?.accion;
  const formularioAbierto = nuevoAbierto || accionPedida === "nuevo-socio";
  const limpiarAccion = () => void navegar(".", { replace: true, state: null });
  useEffect(() => {
    // Al entrar o con Ctrl+F: cursor en el buscador.
    if (accionPedida !== "nuevo-socio") buscador.current?.focus();
  }, [ubicacion.key, accionPedida]);

  const cambiar = <K extends keyof FiltrosSocios>(clave: K, valor: FiltrosSocios[K]) =>
    setFiltros((f) => ({ ...f, [clave]: valor }));

  const filtrados = useMemo(() => (socios.data ? filtrarSocios(socios.data, filtros) : []), [socios.data, filtros]);
  const conteo = useMemo(() => contarParaFiltros(socios.data ?? [], filtros), [socios.data, filtros]);
  const totalActivos = useMemo(() => (socios.data ?? []).filter((s) => s.activo).length, [socios.data]);
  const hayFiltros =
    filtros.busqueda !== "" || filtros.estado !== "todos" || filtros.planId !== "todos" || filtros.activo !== "activos";

  const columnas = useMemo(
    () => col.columns([
      col.display({
        id: "socio",
        header: "Socio",
        cell: ({ row: { original: s } }) => (
          <div>
            {/* El enlace da acceso por teclado y lector de pantalla; la fila entera también es clicable. */}
            <Link
              to={`/socios/${s.id}`}
              className="rounded-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring"
              onClick={(e) => e.stopPropagation()}
            >
              {s.apellido ? `${s.apellido}, ` : ""}
              {s.nombre}
            </Link>
            {!s.activo && <span className="ml-2 text-sm text-muted-foreground">(dado de baja)</span>}
            <p className="text-sm text-muted-foreground">{s.dni ? `DNI ${formatearDni(s.dni)}` : "Sin DNI"}</p>
          </div>
        ),
      }),
      col.accessor("estado", { header: "Estado", cell: (c) => <EstadoBadge estado={c.getValue()} /> }),
      col.accessor("venceEl", {
        header: "Vencimiento",
        cell: ({ row: { original: s } }) => (
          <div>
            <p className="tabular-nums">{formatearFecha(s.venceEl)}</p>
            <p className="text-sm text-muted-foreground">{s.venceEl ? describirVencimiento(s.venceEl, hoy) : ""}</p>
          </div>
        ),
      }),
      col.accessor("planNombre", { header: "Plan", cell: (c) => c.getValue() ?? "—" }),
      col.accessor("telefono", { header: "Teléfono", cell: (c) => <span className="tabular-nums">{formatearTelefono(c.getValue())}</span> }),
      col.display({
        id: "pagar",
        header: () => <span className="sr-only">Cobrar</span>,
        cell: ({ row: { original: s } }) => (
          <Button
            size="lg"
            variant="outline"
            disabled={!s.activo}
            aria-label={`Registrar pago de ${nombreCompleto(s)}`}
            // El botón está dentro de la fila clicable: no debe abrir la ficha.
            onClick={(e) => {
              e.stopPropagation();
              setPagarAId(s.id);
            }}
          >
            <CreditCard aria-hidden /> Registrar pago
          </Button>
        ),
      }),
      col.display({
        id: "ir",
        header: () => <span className="sr-only">Abrir ficha</span>,
        cell: () => <ChevronRight className="size-5 text-muted-foreground" aria-hidden />,
      }),
    ]),
    [hoy],
  );

  const tabla = useTable({ features, columns: columnas, data: filtrados, getRowId: (s) => String(s.id) });

  return (
    <Pagina
      titulo="Socios"
      descripcion={socios.data ? `${totalActivos} ${totalActivos === 1 ? "socio activo" : "socios activos"}` : undefined}
      acciones={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="lg" aria-keyshortcuts="Control+N" onClick={() => setNuevoAbierto(true)}>
              <Plus aria-hidden /> Nuevo socio
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atajo: Ctrl+N</TooltipContent>
        </Tooltip>
      }
    >
      {/* Buscador y filtros */}
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={buscador}
            type="search"
            aria-label="Buscar socio por nombre, apellido o DNI"
            placeholder="Buscar por nombre, apellido o DNI…"
            className="h-14 pr-12 pl-13 text-lg md:text-lg [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            value={filtros.busqueda}
            onChange={(e) => cambiar("busqueda", e.target.value)}
            onKeyDown={(e) => {
              // Enter con un solo resultado abre su ficha directamente.
              const unico = filtrados.length === 1 ? filtrados[0] : undefined;
              if (e.key === "Enter" && unico) void navegar(`/socios/${unico.id}`);
              if (e.key === "Escape") cambiar("busqueda", "");
            }}
          />
          {filtros.busqueda && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Borrar búsqueda"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              onClick={() => {
                cambiar("busqueda", "");
                buscador.current?.focus();
              }}
            >
              <X aria-hidden />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
          <BotonFiltro activo={filtros.estado === "todos"} onClick={() => cambiar("estado", "todos")}>
            Todos
          </BotonFiltro>
          {ESTADOS_FILTRO.map((estado) => {
            const { etiqueta, icono: Icono, colorIcono } = VISUAL_ESTADO[estado];
            const activo = filtros.estado === estado;
            return (
              <BotonFiltro key={estado} activo={activo} onClick={() => cambiar("estado", estado)}>
                <Icono aria-hidden className={activo ? undefined : colorIcono} /> {etiqueta}
                <span className="tabular-nums opacity-80">({conteo[estado]})</span>
              </BotonFiltro>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <FiltroSelect
            id="filtro-plan"
            etiqueta="Plan"
            valor={String(filtros.planId)}
            alCambiar={(v) => cambiar("planId", v === "todos" ? "todos" : Number(v))}
            opciones={[{ valor: "todos", texto: "Todos los planes" }, ...(planes.data ?? []).map((p) => ({ valor: String(p.id), texto: p.nombre }))]}
          />
          <FiltroSelect
            id="filtro-activo"
            etiqueta="Mostrar"
            valor={filtros.activo}
            alCambiar={(v) => cambiar("activo", v as FiltroActivo)}
            opciones={[
              { valor: "activos", texto: "Socios activos" },
              { valor: "inactivos", texto: "Dados de baja" },
              { valor: "todos", texto: "Todos" },
            ]}
          />
          <FiltroSelect
            id="filtro-orden"
            etiqueta="Ordenar por"
            valor={filtros.orden}
            alCambiar={(v) => cambiar("orden", v as OrdenSocios)}
            opciones={[
              { valor: "nombre", texto: "Apellido y nombre" },
              { valor: "vencimiento", texto: "Vencimiento (más próximo primero)" },
            ]}
          />
          {hayFiltros && (
            <Button variant="ghost" onClick={() => setFiltros({ ...FILTROS_INICIALES, orden: filtros.orden })}>
              <X aria-hidden /> Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Resultados */}
      {socios.isPending && <Cargando texto="Cargando socios…" />}
      {socios.error && <ErrorCarga error={socios.error} reintentar={() => void socios.refetch()} />}
      {socios.data?.length === 0 && (
        <Vacio
          icono={Users}
          titulo="Todavía no hay socios"
          descripcion="Agregalos uno por uno o importalos desde tu Excel."
          accion={
            <div className="flex gap-2">
              <Button size="lg" onClick={() => setNuevoAbierto(true)}>
                <UserPlus aria-hidden /> Agregar socio
              </Button>
              <Button size="lg" variant="outline" onClick={() => void navegar("/importar")}>
                Importar desde Excel
              </Button>
            </div>
          }
        />
      )}
      {socios.data && socios.data.length > 0 && filtrados.length === 0 && (
        <Vacio
          icono={Search}
          titulo="No hay socios que coincidan"
          descripcion={filtros.busqueda ? `No se encontró "${filtros.busqueda}" con los filtros elegidos.` : "Probá con otros filtros."}
          accion={
            <Button size="lg" variant="outline" onClick={() => setFiltros({ ...FILTROS_INICIALES, orden: filtros.orden })}>
              Limpiar filtros
            </Button>
          }
        />
      )}
      {filtrados.length > 0 && (
        <>
          <p className="text-muted-foreground" aria-live="polite">
            {filtrados.length === 1 ? "1 socio" : `${filtrados.length} socios`}
            {filtrados.length === 1 && filtros.busqueda ? " · Enter para abrir su ficha" : ""}
          </p>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                {tabla.getHeaderGroups().map((g) => (
                  <TableRow key={g.id}>
                    {g.headers.map((h) => (
                      <TableHead key={h.id} className={cn(SOLO_PANTALLA_ANCHA.has(h.column.id) && "hidden xl:table-cell")}>
                        <tabla.FlexRender header={h} />
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {tabla.getRowModel().rows.map((fila) => (
                  <TableRow
                    key={fila.id}
                    className={cn("cursor-pointer has-focus-visible:bg-muted", !fila.original.activo && "opacity-70")}
                    onClick={() => void navegar(`/socios/${fila.original.id}`)}
                  >
                    {fila.getAllCells().map((c) => (
                      <TableCell key={c.id} className={cn(SOLO_PANTALLA_ANCHA.has(c.column.id) && "hidden xl:table-cell")}>
                        <tabla.FlexRender cell={c} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {pagarA && <RegistrarPagoDialogo socio={pagarA} alCerrar={() => setPagarAId(null)} />}

      <FormularioSocioDialogo
        abierto={formularioAbierto}
        alCerrar={() => {
          setNuevoAbierto(false);
          if (accionPedida) limpiarAccion();
        }}
        socio={null}
        socios={socios.data ?? []}
        alGuardar={(id) => void navegar(`/socios/${id}`)}
      />
    </Pagina>
  );
}

function BotonFiltro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant={activo ? "default" : "outline"} aria-pressed={activo} onClick={onClick}>
      {children}
    </Button>
  );
}

interface PropsFiltroSelect {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  opciones: { valor: string; texto: string }[];
}

function FiltroSelect({ id, etiqueta, valor, alCambiar, opciones }: PropsFiltroSelect) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Select value={valor} onValueChange={alCambiar}>
        <SelectTrigger id={id} className="min-w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
