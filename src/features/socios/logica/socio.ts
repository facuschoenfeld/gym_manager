/**
 * Socios: tipos, validación del formulario, filtros/orden del listado y detección de duplicados.
 * Todo puro (sin base de datos ni React) para poder testearlo.
 */
import { z } from "zod";
import { calcularEstado, diasParaVencer, type EstadoSocio, type ParametrosEstado } from "@/lib/estado";
import type { FechaISO } from "@/lib/fechas";
import { normalizarTelefono } from "@/lib/telefonos";
import { capitalizarNombre, claveNombre, coincideBusqueda, limpiarEspacios, normalizarDni } from "@/lib/texto";

/** Socio tal como sale de la vista v_clientes_vencimiento. */
export interface Socio {
  id: number;
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  planId: number | null;
  planNombre: string | null;
  /** Centavos, precio actual del plan. */
  planMonto: number | null;
  fechaAlta: FechaISO;
  activo: boolean;
  notas: string | null;
  venceEl: FechaISO | null;
  ultimoAviso: string | null;
}

export interface SocioConEstado extends Socio {
  estado: EstadoSocio;
  /** Negativo = días de atraso. null = sin pagos. */
  diasParaVencer: number | null;
}

export function agregarEstado(socios: Socio[], hoy: FechaISO, params: ParametrosEstado): SocioConEstado[] {
  return socios.map((s) => ({
    ...s,
    estado: calcularEstado(s.venceEl, hoy, params),
    diasParaVencer: diasParaVencer(s.venceEl, hoy),
  }));
}

export function nombreCompleto(s: { nombre: string; apellido: string | null }): string {
  return [s.apellido, s.nombre].filter(Boolean).join(", ");
}

// ---------------------------------------------------------------------------
// Formulario de alta / edición
// ---------------------------------------------------------------------------

/** Lo que escribe el usuario (todo texto; el plan como id en texto). */
export interface FormularioSocio {
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string;
  email: string;
  planId: string;
  notas: string;
}

export const FORMULARIO_SOCIO_VACIO: FormularioSocio = {
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  planId: "",
  notas: "",
};

const textoOpcional = z
  .string()
  .transform(limpiarEspacios)
  .transform((t) => (t === "" ? null : t));

/** El esquema depende del código de área configurado (para completar teléfonos). */
export function crearEsquemaSocio(codigoArea: string) {
  return z.object({
    nombre: z.string().transform(capitalizarNombre).pipe(z.string().min(1, "El nombre es obligatorio")),
    apellido: z.string().transform(capitalizarNombre).pipe(z.string().min(1, "El apellido es obligatorio")),
    dni: z.string().transform((texto, ctx) => {
      const r = normalizarDni(texto);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: r.motivo });
        return z.NEVER;
      }
      return r.dni;
    }),
    telefono: z.string().transform((texto, ctx) => {
      if (limpiarEspacios(texto) === "") return null;
      const r = normalizarTelefono(texto, codigoArea);
      if (!r.ok) {
        ctx.addIssue({ code: "custom", message: `${r.motivo}. Ejemplo: 3482 15 123456` });
        return z.NEVER;
      }
      return r.telefono;
    }),
    email: textoOpcional.pipe(z.email("El email no es válido").nullable()),
    planId: z
      .string()
      .regex(/^\d+$/, "Elegí un plan")
      .transform(Number),
    notas: textoOpcional,
  });
}

export type DatosSocio = z.output<ReturnType<typeof crearEsquemaSocio>>;

export function socioAFormulario(s: Socio): FormularioSocio {
  return {
    nombre: s.nombre,
    apellido: s.apellido ?? "",
    dni: s.dni ?? "",
    telefono: s.telefono ?? "",
    email: s.email ?? "",
    planId: s.planId === null ? "" : String(s.planId),
    notas: s.notas ?? "",
  };
}

// ---------------------------------------------------------------------------
// Duplicados (F-SOC-07)
// ---------------------------------------------------------------------------

export interface Duplicados {
  /** Otro socio con el mismo DNI: impide guardar (el DNI es único). */
  mismoDni: Socio | null;
  /** Otros socios con el mismo nombre y apellido: solo advertencia. */
  mismoNombre: Socio[];
}

export function buscarDuplicados(
  datos: { nombre: string; apellido: string | null; dni: string | null },
  socios: Socio[],
  idActual?: number,
): Duplicados {
  const otros = socios.filter((s) => s.id !== idActual);
  const mismoDni = datos.dni ? (otros.find((s) => s.dni === datos.dni) ?? null) : null;
  const clave = claveNombre(datos.nombre, datos.apellido);
  const mismoNombre = otros.filter((s) => s.id !== mismoDni?.id && claveNombre(s.nombre, s.apellido) === clave);
  return { mismoDni, mismoNombre };
}

// ---------------------------------------------------------------------------
// Filtros y orden del listado (F-SOC-01, F-SOC-03)
// ---------------------------------------------------------------------------

export type FiltroActivo = "activos" | "inactivos" | "todos";
export type OrdenSocios = "nombre" | "vencimiento";

export interface FiltrosSocios {
  busqueda: string;
  estado: EstadoSocio | "todos";
  planId: number | "todos";
  activo: FiltroActivo;
  orden: OrdenSocios;
}

export const FILTROS_INICIALES: FiltrosSocios = {
  busqueda: "",
  estado: "todos",
  planId: "todos",
  activo: "activos",
  orden: "nombre",
};

const comparadorTexto = new Intl.Collator("es-AR", { sensitivity: "base" });

function compararPorNombre(a: Socio, b: Socio): number {
  return (
    comparadorTexto.compare(a.apellido ?? "", b.apellido ?? "") || comparadorTexto.compare(a.nombre, b.nombre)
  );
}

/** Vencimiento más próximo (o más atrasado) primero; los que no tienen pagos, al final. */
function compararPorVencimiento(a: SocioConEstado, b: SocioConEstado): number {
  if (a.venceEl === b.venceEl) return compararPorNombre(a, b);
  if (a.venceEl === null) return 1;
  if (b.venceEl === null) return -1;
  return a.venceEl < b.venceEl ? -1 : 1;
}

export function filtrarSocios(socios: SocioConEstado[], f: FiltrosSocios): SocioConEstado[] {
  const resultado = socios.filter(
    (s) =>
      (f.activo === "todos" || s.activo === (f.activo === "activos")) &&
      (f.estado === "todos" || s.estado === f.estado) &&
      (f.planId === "todos" || s.planId === f.planId) &&
      coincideBusqueda(f.busqueda, s.nombre, s.apellido, s.dni),
  );
  return resultado.sort(f.orden === "nombre" ? compararPorNombre : compararPorVencimiento);
}

/** Cantidad de socios por estado, sobre la lista que recibe (el filtrado lo hace quien llama). */
export function contarPorEstado(socios: SocioConEstado[]): Record<EstadoSocio, number> {
  const conteo: Record<EstadoSocio, number> = { pago: 0, por_vencer: 0, vencido: 0, sin_pagos: 0 };
  for (const s of socios) conteo[s.estado] += 1;
  return conteo;
}

/**
 * Contadores de los botones de estado: respetan los demás filtros (búsqueda, plan, activos/de baja)
 * pero no el de estado, para que cada botón diga cuántos aparecerían al tocarlo.
 */
export function contarParaFiltros(socios: SocioConEstado[], f: FiltrosSocios): Record<EstadoSocio, number> {
  return contarPorEstado(filtrarSocios(socios, { ...f, estado: "todos" }));
}

const esquemaFiltrosGuardados = z
  .object({
    busqueda: z.string(),
    estado: z.enum(["todos", "pago", "por_vencer", "vencido", "sin_pagos"]),
    planId: z.union([z.literal("todos"), z.number().int().positive()]),
    activo: z.enum(["activos", "inactivos", "todos"]),
    orden: z.enum(["nombre", "vencimiento"]),
  })
  .partial();

/** Filtros guardados en sessionStorage (texto JSON). Lo inválido o corrupto se descarta. */
export function leerFiltrosGuardados(json: string | null): FiltrosSocios {
  if (!json) return FILTROS_INICIALES;
  try {
    const r = esquemaFiltrosGuardados.safeParse(JSON.parse(json));
    return r.success ? { ...FILTROS_INICIALES, ...r.data } : FILTROS_INICIALES;
  } catch {
    return FILTROS_INICIALES;
  }
}
