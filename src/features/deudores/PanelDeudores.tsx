/**
 * Panel de inicio: contadores por estado, lista de deudores activos (vencidos y por vencer) e ingresos del mes.
 * Desde la lista se puede avisar por WhatsApp a los vencidos: se abre wa.me con el mensaje prellenado
 * y se registra el aviso (para ver "último aviso" y no insistir de más).
 */
import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CircleCheck, Loader2, MessageCircle, PhoneOff } from "lucide-react";
import { Cargando, ErrorCarga, Vacio } from "@/components/EstadosCarga";
import { avisar } from "@/components/notificar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfig } from "@/features/configuracion/hooks";
import { EstadoBadge, VISUAL_ESTADO } from "@/features/socios/componentes/EstadoBadge";
import { useSocios } from "@/features/socios/hooks";
import type { SocioConEstado } from "@/features/socios/logica/socio";
import { formatearPesos } from "@/lib/dinero";
import { describirVencimiento, type EstadoSocio } from "@/lib/estado";
import { formatearFecha, hoyISO } from "@/lib/fechas";
import { normalizarTelefono } from "@/lib/telefonos";
import { cn } from "@/lib/utils";
import { useIngresosDelMes, useRegistrarAviso } from "./hooks";
import { armarMensajeAviso, contarEstados, listarDeudores, montoParaAviso, urlWhatsapp } from "./logica/deudores";

const ORDEN_CONTADORES: EstadoSocio[] = ["pago", "por_vencer", "vencido", "sin_pagos"];

export function PanelDeudores() {
  const socios = useSocios();
  const config = useConfig();
  const hoy = hoyISO();
  const ingresos = useIngresosDelMes(hoy);
  const registrarAviso = useRegistrarAviso();
  // Socio al que se le está abriendo WhatsApp (para mostrar el progreso en su fila).
  const [enviandoA, setEnviandoA] = useState<number | null>(null);

  if (socios.isPending || config.isPending) return <Cargando texto="Cargando deudores…" />;
  if (socios.error || config.error) {
    return (
      <ErrorCarga
        error={socios.error ?? config.error}
        reintentar={() => {
          void socios.refetch();
          void config.refetch();
        }}
      />
    );
  }
  if (!socios.data || !config.data) return null;

  const todos = socios.data;
  const contadores = contarEstados(todos);
  const deudores = listarDeudores(todos);
  const cfg = config.data;

  const avisarPorWhatsapp = async (s: SocioConEstado, telefono: string) => {
    const texto = armarMensajeAviso(cfg.plantilla_aviso, {
      nombre: s.nombre,
      gimnasio: cfg.nombre_gimnasio,
      venceEl: s.venceEl,
      monto: montoParaAviso(s.planMonto),
    });
    setEnviandoA(s.id);
    try {
      await openUrl(urlWhatsapp(telefono, texto));
    } catch (e) {
      setEnviandoA(null);
      avisar.error("No se pudo abrir WhatsApp", e);
      return;
    }
    // Se registra aparte: si falla, WhatsApp ya se abrió y el mensaje hay que avisarlo distinto.
    try {
      await registrarAviso.mutateAsync({ clienteId: s.id, tipo: "vencida" });
      avisar.exito("Se abrió WhatsApp", {
        descripcion: "Mandá el mensaje desde WhatsApp. Quedó anotado el aviso.",
      });
    } catch (e) {
      avisar.error("Se abrió WhatsApp, pero no se pudo anotar el aviso", e);
    } finally {
      setEnviandoA(null);
    }
  };

  return (
    <section aria-label="Panel de socios" className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ORDEN_CONTADORES.map((estado) => {
          const { etiqueta, icono: Icono, clases } = VISUAL_ESTADO[estado];
          return (
            <div
              key={estado}
              role="group"
              aria-label={`${etiqueta}: ${contadores[estado]}`}
              className={cn("flex items-center justify-between gap-4 rounded-xl border-2 p-5", clases)}
            >
              <span className="flex items-center gap-2 text-lg font-semibold">
                <Icono className="size-6" aria-hidden /> {etiqueta}
              </span>
              <span className="text-4xl font-bold tabular-nums" aria-hidden>
                {contadores[estado]}
              </span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Deudores</CardTitle>
          <CardDescription className="text-base">
            Socios activos vencidos o por vencer, primero los más atrasados. Los vencidos tienen botón para avisar por
            WhatsApp. Los socios sin pagos no aparecen acá.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deudores.length === 0 ? (
            <Vacio
              icono={CircleCheck}
              titulo="No hay socios vencidos ni por vencer"
              descripcion="Todos los socios activos con pagos están al día."
            />
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Lista de deudores">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Socio</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Último aviso</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deudores.map((s) => {
                    const telefono = normalizarTelefono(s.telefono, cfg.codigo_area);
                    const nombreCompleto = s.apellido ? `${s.apellido} ${s.nombre}` : s.nombre;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.apellido ? `${s.apellido}, ${s.nombre}` : s.nombre}</TableCell>
                        <TableCell>
                          {telefono.ok ? (
                            s.telefono
                          ) : (
                            <span className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-300">
                              <PhoneOff className="size-5 shrink-0" aria-hidden />
                              {telefono.motivo}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <EstadoBadge estado={s.estado} />
                        </TableCell>
                        <TableCell>
                          {formatearFecha(s.venceEl)}
                          <span className="block text-base text-muted-foreground">{describirVencimiento(s.venceEl, hoy)}</span>
                        </TableCell>
                        <TableCell>{s.ultimoAviso ? formatearFecha(s.ultimoAviso) : "Nunca"}</TableCell>
                        <TableCell>
                          {s.estado === "vencido" ? (
                            <Button
                              variant="outline"
                              onClick={() => telefono.ok && void avisarPorWhatsapp(s, telefono.telefono)}
                              disabled={enviandoA !== null || !telefono.ok}
                              aria-label={`Avisar por WhatsApp a ${nombreCompleto}`}
                            >
                              {enviandoA === s.id ? (
                                <Loader2 className="animate-spin" aria-hidden />
                              ) : (
                                <MessageCircle aria-hidden />
                              )}
                              {enviandoA === s.id ? "Abriendo…" : "WhatsApp"}
                            </Button>
                          ) : (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <VISUAL_ESTADO.por_vencer.icono className="size-5" aria-hidden /> Todavía no venció
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Ingresos del mes</CardTitle>
          <CardDescription className="text-base">Suma de los pagos registrados este mes, sin los anulados.</CardDescription>
        </CardHeader>
        <CardContent>
          {ingresos.isPending && (
            <p role="status" className="text-base text-muted-foreground">
              Calculando…
            </p>
          )}
          {ingresos.error && <ErrorCarga error={ingresos.error} reintentar={() => void ingresos.refetch()} />}
          {ingresos.data && (
            <p className="text-lg">
              <span className="text-3xl font-bold tabular-nums">{formatearPesos(ingresos.data.total)}</span>{" "}
              <span className="text-muted-foreground">
                en {ingresos.data.cantidad} {ingresos.data.cantidad === 1 ? "pago" : "pagos"}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
