import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Ban, CreditCard, Pencil, Receipt, UserCheck, UserX } from "lucide-react";
import { useAtajos } from "@/components/atajos";
import { CLASES_PELIGRO_SECUNDARIA, Confirmar } from "@/components/Confirmar";
import { Cargando, ErrorCarga, Vacio } from "@/components/EstadosCarga";
import { Pagina } from "@/components/layout/Pagina";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Pago } from "@/db/queries/pagos";
import { formatearPesos } from "@/lib/dinero";
import { describirVencimiento } from "@/lib/estado";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { esTelefonoWhatsApp, formatearTelefono } from "@/lib/telefonos";
import { formatearDni } from "@/lib/texto";
import { cn } from "@/lib/utils";
import { AnularPagoDialogo } from "@/features/pagos/AnularPagoDialogo";
import { RegistrarPagoDialogo } from "@/features/pagos/RegistrarPagoDialogo";
import { EstadoBadge } from "./componentes/EstadoBadge";
import { FormularioSocioDialogo } from "./FormularioSocio";
import { useCambiarActivoSocio, usePagosDeSocio, useSocios } from "./hooks";
import { nombreCompleto } from "./logica/socio";

export function FichaSocio() {
  const { id: idTexto } = useParams();
  const id = Number(idTexto);
  const socios = useSocios();
  const pagos = usePagosDeSocio(id);
  const cambiarActivo = useCambiarActivoSocio();
  const navegar = useNavigate();
  const [editando, setEditando] = useState(false);
  const [confirmarBaja, setConfirmarBaja] = useState(false);
  const [registrandoPago, setRegistrandoPago] = useState(false);
  const [pagoAAnular, setPagoAAnular] = useState<Pago | null>(null);
  const botonBaja = useRef<HTMLButtonElement>(null);
  const botonRegistrar = useRef<HTMLButtonElement>(null);
  const hoy = hoyISO();

  // Ctrl+P: registrar un pago. Con el socio de baja no se abre el diálogo (no se puede cobrar).
  useAtajos([
    {
      tecla: "p",
      ctrl: true,
      accion: () => {
        const actual = socios.data?.find((s) => s.id === id);
        if (!actual) return;
        if (actual.activo) setRegistrandoPago(true);
        else avisar.info("Reactivá al socio para registrar pagos");
      },
    },
  ]);

  if (socios.isPending) return <Pagina titulo="Socio"><Cargando texto="Cargando socio…" /></Pagina>;
  if (socios.error) return <Pagina titulo="Socio"><ErrorCarga error={socios.error} reintentar={() => void socios.refetch()} /></Pagina>;

  const socio = socios.data?.find((s) => s.id === id);
  if (!socio) {
    return (
      <Pagina titulo="Socio no encontrado">
        <Vacio titulo="Este socio no existe" accion={<Button size="lg" onClick={() => void navegar("/socios")}>Volver a Socios</Button>} />
      </Pagina>
    );
  }

  const aplicarActivo = async (activo: boolean) => {
    try {
      await cambiarActivo.mutateAsync({ id: socio.id, activo });
      avisar.exito(activo ? "Socio reactivado" : "Socio dado de baja", { descripcion: nombreCompleto(socio) });
      setConfirmarBaja(false);
    } catch (e) {
      avisar.error("No se pudo cambiar el estado del socio", e);
    }
  };

  return (
    <Pagina
      titulo={nombreCompleto(socio)}
      descripcion={socio.activo ? undefined : "Este socio está dado de baja. Sus datos y pagos se conservan."}
      acciones={
        <>
          <Button
            ref={botonRegistrar}
            size="lg"
            onClick={() => setRegistrandoPago(true)}
            disabled={!socio.activo}
            aria-keyshortcuts="Control+P"
          >
            <CreditCard aria-hidden /> Registrar pago
          </Button>
          <Button size="lg" variant="outline" onClick={() => setEditando(true)}>
            <Pencil aria-hidden /> Editar
          </Button>
          {socio.activo ? (
            <Button ref={botonBaja} size="lg" variant="outline" onClick={() => setConfirmarBaja(true)}>
              <UserX aria-hidden /> Dar de baja
            </Button>
          ) : (
            <Button size="lg" onClick={() => void aplicarActivo(true)} disabled={cambiarActivo.isPending}>
              <UserCheck aria-hidden /> Reactivar
            </Button>
          )}
        </>
      }
    >
      <Link to="/socios" className="-mt-2 inline-flex w-fit items-center gap-2 rounded-md text-base font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none">
        <ArrowLeft className="size-5" aria-hidden /> Volver al listado
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl">Cuota</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <EstadoBadge estado={socio.estado} grande />
            <Dato etiqueta="Vencimiento">
              {formatearFecha(socio.venceEl)}
              {socio.venceEl && <span className="block text-muted-foreground">{describirVencimiento(socio.venceEl, hoy)}</span>}
            </Dato>
            <Dato etiqueta="Plan">
              {socio.planNombre ?? "Sin plan"}
              {socio.planMonto !== null && socio.planMonto > 0 && (
                <span className="block text-muted-foreground">{formatearPesos(socio.planMonto)}</span>
              )}
            </Dato>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Datos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="DNI">{socio.dni ? formatearDni(socio.dni) : "—"}</Dato>
            <Dato etiqueta="Teléfono">
              {formatearTelefono(socio.telefono)}
              {socio.telefono && !esTelefonoWhatsApp(socio.telefono) && (
                <span className="block text-sm text-amber-800 dark:text-amber-300">No tiene formato de celular para WhatsApp</span>
              )}
            </Dato>
            <Dato etiqueta="Email">{socio.email ?? "—"}</Dato>
            <Dato etiqueta="Socio desde">{formatearFecha(socio.fechaAlta)}</Dato>
            <Dato etiqueta="Último aviso por WhatsApp">{socio.ultimoAviso ? formatearFecha(socio.ultimoAviso) : "Nunca"}</Dato>
            <div className="sm:col-span-2">
              <Dato etiqueta="Notas">
                <span className="whitespace-pre-wrap">{socio.notas ?? "—"}</span>
              </Dato>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {pagos.isPending && <Cargando texto="Cargando pagos…" />}
          {pagos.error && <ErrorCarga error={pagos.error} reintentar={() => void pagos.refetch()} />}
          {pagos.data?.length === 0 && <Vacio icono={Receipt} titulo="Todavía no tiene pagos registrados" />}
          {pagos.data && pagos.data.length > 0 && <TablaPagos pagos={pagos.data} alAnular={setPagoAAnular} />}
        </CardContent>
      </Card>

      {registrandoPago && socio.activo && (
        <RegistrarPagoDialogo socio={socio} alCerrar={() => setRegistrandoPago(false)} />
      )}
      {pagoAAnular && (
        <AnularPagoDialogo
          pago={pagoAAnular}
          pagos={pagos.data ?? []}
          nombreSocio={nombreCompleto(socio)}
          alCerrar={() => setPagoAAnular(null)}
          focoAlCerrar={botonRegistrar}
        />
      )}

      <FormularioSocioDialogo
        abierto={editando}
        alCerrar={() => setEditando(false)}
        socio={socio}
        socios={socios.data ?? []}
      />
      <Confirmar
        abierto={confirmarBaja}
        alCambiar={setConfirmarBaja}
        titulo={`¿Dar de baja a ${nombreCompleto(socio)}?`}
        descripcion="No se borra nada: sus datos y pagos se conservan, y podés reactivarlo cuando vuelva. Deja de aparecer en el listado de socios activos y en los deudores."
        accion={{ texto: "Dar de baja", peligroso: true, alConfirmar: () => void aplicarActivo(false) }}
        procesando={cambiarActivo.isPending}
        focoAlCerrar={botonBaja}
      />
    </Pagina>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{etiqueta}</p>
      <div className="text-base">{children}</div>
    </div>
  );
}

function TablaPagos({ pagos, alAnular }: { pagos: Pago[]; alAnular: (pago: Pago) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha de pago</TableHead>
          <TableHead>Cubre hasta</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Medio</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagos.map((p) => (
          <TableRow key={p.id} className={cn(p.anulado && "text-muted-foreground")}>
            <TableCell className="tabular-nums">
              <span className={cn(p.anulado && "line-through")}>{formatearFecha(p.fechaPago)}</span>
              {p.anulado && (
                <span className="mt-1 flex items-center gap-1 text-base font-medium text-destructive">
                  <Ban className="size-4" aria-hidden /> Anulado{p.anuladoMotivo ? `: ${p.anuladoMotivo}` : ""}
                </span>
              )}
              {p.origen === "importacion" && <span className="block text-sm">Importado del Excel</span>}
            </TableCell>
            <TableCell className={cn("tabular-nums", p.anulado && "line-through")}>{formatearFecha(p.venceEl)}</TableCell>
            <TableCell>{p.planNombre ?? "—"}</TableCell>
            <TableCell>
              {p.medio === "efectivo" ? "Efectivo" : "Transferencia"}
              {p.referencia && <span className="block text-sm text-muted-foreground">{p.referencia}</span>}
            </TableCell>
            <TableCell className={cn("text-right tabular-nums", p.anulado && "line-through")}>{formatearPesos(p.monto)}</TableCell>
            <TableCell>
              {!p.anulado && (
                <Button
                  variant="outline"
                  className={CLASES_PELIGRO_SECUNDARIA}
                  onClick={() => alAnular(p)}
                  aria-label={`Anular el pago de ${formatearPesos(p.monto)} del ${formatearFecha(p.fechaPago)}, cubre hasta ${formatearFecha(p.venceEl)}`}
                >
                  <Ban aria-hidden /> Anular
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
