/**
 * Panel de deudores e inicio: contadores, orden de la lista y textos de aviso por WhatsApp.
 * Puro (sin base de datos ni React) para poder testearlo.
 */
import type { SocioConEstado } from "@/features/socios/logica/socio";
import { formatearPesos } from "@/lib/dinero";
import { formatearFecha, type FechaISO } from "@/lib/fechas";
import { PRIORIDAD_ESTADO, type EstadoSocio } from "@/lib/estado";

export type ContadoresEstado = Record<EstadoSocio, number>;

/** Cuántos socios activos hay en cada estado. Los dados de baja no cuentan. */
export function contarEstados(socios: SocioConEstado[]): ContadoresEstado {
  const c: ContadoresEstado = { pago: 0, por_vencer: 0, vencido: 0, sin_pagos: 0 };
  for (const s of socios) if (s.activo) c[s.estado]++;
  return c;
}

/**
 * Deudores activos (vencidos y por vencer). Primero los vencidos, y dentro de cada grupo los más atrasados;
 * después los que vencen antes.
 */
export function listarDeudores(socios: SocioConEstado[]): SocioConEstado[] {
  return socios
    .filter((s) => s.activo && (s.estado === "vencido" || s.estado === "por_vencer"))
    .sort(
      (a, b) =>
        PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado] ||
        (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0),
    );
}

/** Texto que se usa si la plantilla de aviso quedó vacía. Debe coincidir con el sembrado de la migración 001. */
export const PLANTILLA_AVISO_POR_DEFECTO =
  "Hola {nombre}! Te escribimos de {gimnasio}. Tu cuota venció el {vencimiento}. El valor actual es {monto}. Cuando puedas, acercate a regularizarla. ¡Gracias!";

/** Monto para el aviso: null si el plan no tiene precio cargado (0 o sin plan). */
export function montoParaAviso(planMonto: number | null): number | null {
  return planMonto !== null && planMonto > 0 ? planMonto : null;
}

export interface DatosAviso {
  nombre: string;
  gimnasio: string;
  venceEl: FechaISO | null;
  /** Centavos del precio actual del plan. null = sin precio. */
  monto: number | null;
}

/**
 * Arma el mensaje reemplazando {nombre}, {gimnasio}, {vencimiento} y {monto}.
 * Los marcadores que no se reconocen se dejan tal cual.
 */
export function armarMensajeAviso(plantilla: string, datos: DatosAviso): string {
  const base = plantilla.trim() === "" ? PLANTILLA_AVISO_POR_DEFECTO : plantilla;
  const valores: Record<string, string> = {
    nombre: datos.nombre,
    gimnasio: datos.gimnasio,
    vencimiento: formatearFecha(datos.venceEl),
    monto: datos.monto === null ? "" : formatearPesos(datos.monto),
  };
  return base.replace(/\{(nombre|gimnasio|vencimiento|monto)\}/g, (marca, clave: string) => valores[clave] ?? marca);
}

/** Link wa.me con el texto prellenado. El teléfono debe venir ya normalizado (549 + 10 dígitos). */
export function urlWhatsapp(telefono: string, texto: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}
