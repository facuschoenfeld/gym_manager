/**
 * Importación de socios desde Excel: mapeo de columnas, lectura de cada celda, validación de filas,
 * duplicados dentro del archivo y decisión de alta o actualización. Todo puro (sin base ni React).
 */
import { z } from "zod";
import type { Plan } from "@/features/planes/logica/plan";
import type { Socio } from "@/features/socios/logica/socio";
import { parsearPesos } from "@/lib/dinero";
import { aISO, desdeSerialExcel, hoyISO, parsearFechaAR, sumarDias, sumarPeriodo, type FechaISO } from "@/lib/fechas";
import { normalizarTelefono } from "@/lib/telefonos";
import { capitalizarNombre, claveNombre, limpiarEspacios, normalizarBusqueda, normalizarDni } from "@/lib/texto";

// ---------------------------------------------------------------------------
// Mapeo de columnas
// ---------------------------------------------------------------------------

export const CAMPOS_IMPORTABLES = [
  "nombre",
  "apellido",
  "dni",
  "telefono",
  "email",
  "plan",
  "ultimoPago",
  "vencimiento",
  "monto",
] as const;
export type CampoImportable = (typeof CAMPOS_IMPORTABLES)[number];

export const ETIQUETA_CAMPO: Record<CampoImportable, string> = {
  nombre: "Nombre",
  apellido: "Apellido",
  dni: "DNI",
  telefono: "Teléfono",
  email: "Email",
  plan: "Plan",
  ultimoPago: "Último pago",
  vencimiento: "Vencimiento",
  monto: "Monto",
};

/** Un campo (o null = ignorar) por cada columna del archivo, en orden. */
export type MapeoColumnas = (CampoImportable | null)[];

/** Nombres de encabezado que se reconocen para cada campo (ya normalizados, ver normalizarEncabezado). */
const ALIAS: Record<CampoImportable, string[]> = {
  nombre: ["nombre", "nombres", "name"],
  apellido: ["apellido", "apellidos"],
  dni: ["dni", "documento", "nrodocumento", "numerodedocumento"],
  telefono: ["telefono", "telefonocelular", "telefonomovil", "tel", "celular", "cel", "whatsapp"],
  email: ["email", "mail", "correo", "correoelectronico"],
  plan: ["plan", "tipodeplan"],
  ultimoPago: ["ultimopago", "fechadepago", "ultimopagado"],
  vencimiento: ["vencimiento", "vence", "vencea", "fechadevencimiento", "vencimientos"],
  monto: ["monto", "precio", "importe"],
};

/** "Teléfono celular " -> "telefonocelular" (sin tildes, signos ni espacios). */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Propone el mapeo a partir de los encabezados. Cada campo se asigna una sola vez. */
export function detectarMapeo(encabezados: string[]): MapeoColumnas {
  const usados = new Set<CampoImportable>();
  return encabezados.map((h) => {
    const n = normalizarEncabezado(h);
    const campo = CAMPOS_IMPORTABLES.find((c) => !usados.has(c) && ALIAS[c].includes(n));
    if (campo) usados.add(campo);
    return campo ?? null;
  });
}

/** Sin columna de nombre no se puede importar nada. */
export function mapeoTieneNombre(mapeo: MapeoColumnas): boolean {
  return mapeo.includes("nombre");
}

const ESQUEMA_MAPEO_GUARDADO = z.object({
  encabezados: z.array(z.string()),
  mapeo: z.array(z.string().nullable()),
});

/** Texto que se guarda en config: el mapeo junto con los encabezados del archivo que se usó. */
export function guardarMapeo(encabezados: string[], mapeo: MapeoColumnas): string {
  return JSON.stringify({ encabezados: encabezados.map(normalizarEncabezado), mapeo });
}

/**
 * Lee el mapeo guardado. Solo se usa si los encabezados del archivo actual son los mismos (ignorando
 * tildes y mayúsculas); si no, devuelve null y se usa la detección automática.
 */
export function leerMapeoGuardado(texto: string, encabezados: string[]): MapeoColumnas | null {
  if (texto.trim() === "") return null;
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    return null;
  }
  const r = ESQUEMA_MAPEO_GUARDADO.safeParse(dato);
  if (!r.success) return null;
  const actuales = encabezados.map(normalizarEncabezado);
  const { encabezados: guardados, mapeo } = r.data;
  if (guardados.length !== actuales.length || guardados.some((g, i) => g !== actuales[i])) return null;
  const esCampo = (v: string | null): v is CampoImportable =>
    v !== null && (CAMPOS_IMPORTABLES as readonly string[]).includes(v);
  return mapeo.map((v) => (esCampo(v) ? v : null));
}

// ---------------------------------------------------------------------------
// Lectura de celdas
// ---------------------------------------------------------------------------

export interface FilaImportacion {
  /** Número de fila en la hoja de Excel (1 = encabezados). */
  numero: number;
  celdas: unknown[];
}

export interface SocioImportable {
  nombre: string;
  apellido: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  planId: number | null;
  pago: { fechaPago: FechaISO; venceEl: FechaISO; monto: number; referencia: string | null } | null;
}

export interface FilaValidada {
  numero: number;
  celdas: unknown[];
  errores: string[];
  avisos: string[];
  /** null si la fila tiene errores. */
  socio: SocioImportable | null;
}

export interface ContextoImportacion {
  planes: Plan[];
  codigoArea: string;
  hoy: FechaISO;
}

function texto(celda: unknown): string {
  if (celda === null || celda === undefined) return "";
  if (typeof celda === "number") return Number.isFinite(celda) ? String(celda) : "";
  if (typeof celda === "string") return celda;
  return "";
}

/** Fecha de una celda: null si está vacía, "invalida" si no se entiende. */
type FechaCelda = FechaISO | null | "invalida";

export function fechaDeCelda(celda: unknown): FechaCelda {
  if (celda === null || celda === undefined || celda === "") return null;
  if (celda instanceof Date) return Number.isNaN(celda.getTime()) ? "invalida" : aISO(celda);
  // Solo las celdas numéricas son número de serie de Excel; un texto con dígitos no lo es.
  if (typeof celda === "number") return desdeSerialExcel(celda) ?? "invalida";
  if (typeof celda === "string") {
    const t = limpiarEspacios(celda);
    if (t === "") return null;
    return parsearFechaAR(t) ?? "invalida";
  }
  return "invalida";
}

/** Una fecha de pago o vencimiento tiene que estar entre 2000 y un año después de hoy. */
export function fechaRazonable(iso: FechaISO, hoy: FechaISO): boolean {
  return iso >= "2000-01-01" && iso <= sumarDias(hoy, 366);
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Referencia de los pagos que solo guardan un vencimiento (sin cobro real). */
export const REFERENCIA_VENCIMIENTO_IMPORTADO = "Vencimiento importado (sin cobro)";

/** Valida una fila y arma los datos del socio. Los duplicados dentro del archivo se revisan aparte. */
export function validarFila(fila: FilaImportacion, mapeo: MapeoColumnas, ctx: ContextoImportacion): FilaValidada {
  const errores: string[] = [];
  const avisos: string[] = [];
  const valor = (campo: CampoImportable): unknown => {
    const i = mapeo.indexOf(campo);
    return i === -1 ? undefined : fila.celdas[i];
  };

  const nombre = capitalizarNombre(texto(valor("nombre")));
  if (nombre === "") errores.push("Falta el nombre");

  const apellidoTexto = capitalizarNombre(texto(valor("apellido")));
  const apellido = apellidoTexto === "" ? null : apellidoTexto;

  const dni = normalizarDni(texto(valor("dni")));
  if (!dni.ok) errores.push(`DNI: ${dni.motivo}`);

  let telefono: string | null = null;
  const telTexto = texto(valor("telefono")).trim();
  if (telTexto !== "") {
    const t = normalizarTelefono(telTexto, ctx.codigoArea);
    if (t.ok) telefono = t.telefono;
    else errores.push(`Teléfono: ${t.motivo}`);
  }

  let email: string | null = null;
  const emailTexto = limpiarEspacios(texto(valor("email"))).toLowerCase();
  if (emailTexto !== "") {
    if (RE_EMAIL.test(emailTexto)) email = emailTexto;
    else avisos.push(`Email "${emailTexto}" no es válido: se importa sin email`);
  }

  let plan: Plan | null = null;
  const planTexto = limpiarEspacios(texto(valor("plan")));
  if (planTexto !== "") {
    plan = ctx.planes.find((p) => normalizarBusqueda(p.nombre) === normalizarBusqueda(planTexto)) ?? null;
    if (!plan) avisos.push(`El plan "${planTexto}" no existe: se importa sin plan`);
  }

  const ultimoCelda = fechaDeCelda(valor("ultimoPago"));
  const ultimoPago = ultimoCelda && ultimoCelda !== "invalida" ? ultimoCelda : null;
  if (ultimoCelda === "invalida") errores.push("Último pago: la fecha no se entiende (usá dd/mm/aaaa)");
  else if (ultimoPago && !fechaRazonable(ultimoPago, ctx.hoy)) {
    errores.push("Último pago: la fecha está fuera de rango (entre 2000 y un año desde hoy)");
  }

  const venceCelda = fechaDeCelda(valor("vencimiento"));
  const vence = venceCelda && venceCelda !== "invalida" ? venceCelda : null;
  if (venceCelda === "invalida") errores.push("Vencimiento: la fecha no se entiende (usá dd/mm/aaaa)");
  else if (vence && !fechaRazonable(vence, ctx.hoy)) {
    errores.push("Vencimiento: la fecha está fuera de rango (entre 2000 y un año desde hoy)");
  }

  let monto: number | null = null;
  const montoCelda = valor("monto");
  if (montoCelda !== null && montoCelda !== undefined && texto(montoCelda).trim() !== "") {
    const m = parsearPesos(typeof montoCelda === "number" ? montoCelda : texto(montoCelda));
    if (m === null) errores.push("Monto: no es un importe válido");
    else monto = m;
  }

  if (ultimoPago && vence && vence < ultimoPago) {
    errores.push("El vencimiento es anterior a la fecha del último pago");
  }

  // Pagos: el monto solo sale de la columna Monto. Si falta, queda en 0 (no se usa el precio actual del plan:
  // sería inventar un importe histórico).
  let pago: SocioImportable["pago"] = null;
  if (ultimoPago) {
    const venceCalculado = vence ?? (plan ? sumarPeriodo(ultimoPago, plan.periodo, plan.cantidad) : null);
    if (!venceCalculado) {
      errores.push("El último pago necesita un plan o una fecha de vencimiento");
    } else {
      if (monto === null) avisos.push("No hay monto: el pago queda en $ 0");
      pago = { fechaPago: ultimoPago, venceEl: venceCalculado, monto: monto ?? 0, referencia: null };
    }
  } else if (vence) {
    // Sin fecha de último pago la base necesita un pago para guardar el vencimiento. No es un cobro real:
    // va con monto 0 y una referencia, y los ingresos del mes no lo cuentan.
    const fechaPago = vence < ctx.hoy ? vence : ctx.hoy;
    avisos.push(`No hay fecha de último pago: se carga un registro sin cobro para guardar el vencimiento (${vence})`);
    pago = { fechaPago, venceEl: vence, monto: 0, referencia: REFERENCIA_VENCIMIENTO_IMPORTADO };
  }

  const socio: SocioImportable | null =
    errores.length === 0 && dni.ok
      ? {
          nombre,
          apellido,
          dni: dni.dni,
          telefono,
          email,
          planId: plan?.id ?? null,
          pago,
        }
      : null;
  return { numero: fila.numero, celdas: fila.celdas, errores, avisos, socio };
}

/**
 * Valida todo el archivo. Un DNI repetido deja la segunda aparición con error; un nombre repetido sin
 * DNI solo avisa (podría ser otra persona con el mismo nombre).
 */
export function validarArchivo(filas: FilaImportacion[], mapeo: MapeoColumnas, ctx: ContextoImportacion): FilaValidada[] {
  const resultados = filas.map((f) => validarFila(f, mapeo, ctx));
  const porDni = new Map<string, number>();
  const porNombre = new Map<string, number>();
  for (const r of resultados) {
    if (!r.socio) continue;
    const s = r.socio;
    if (s.dni) {
      const previa = porDni.get(s.dni);
      if (previa !== undefined) {
        r.errores.push(`DNI repetido en el archivo (también en la fila ${previa})`);
        r.socio = null;
      } else {
        porDni.set(s.dni, r.numero);
      }
    } else {
      const clave = claveNombre(s.nombre, s.apellido);
      const previa = porNombre.get(clave);
      if (previa !== undefined) r.avisos.push(`Posible duplicado de la fila ${previa} (mismo nombre, sin DNI)`);
      else porNombre.set(clave, r.numero);
    }
  }
  return resultados;
}

// ---------------------------------------------------------------------------
// Alta o actualización
// ---------------------------------------------------------------------------

export type AccionImportacion =
  | { tipo: "crear"; socio: SocioImportable; numero: number }
  | { tipo: "actualizar"; socio: SocioImportable; numero: number; clienteId: number; dadoDeBaja: boolean };

/**
 * Decide para cada fila válida si crea el socio o actualiza uno existente. El DNI identifica al socio;
 * sin DNI se usa nombre + apellido (por eso la fila avisa "posible coincidencia").
 */
export interface ConflictoImportacion {
  numero: number;
  motivo: string;
}

export interface PlanImportacion {
  acciones: AccionImportacion[];
  /** Filas que no se pueden importar aunque sean válidas (ambigüedad con socios existentes). */
  conflictos: ConflictoImportacion[];
}

export function planificarAcciones(
  validas: FilaValidada[],
  existentes: Pick<Socio, "id" | "dni" | "nombre" | "apellido" | "activo">[],
): PlanImportacion {
  const acciones: AccionImportacion[] = [];
  const conflictos: ConflictoImportacion[] = [];
  // Socio existente -> fila que ya lo actualiza. Dos filas no pueden tocar al mismo socio en un lote.
  const tocados = new Map<number, number>();
  for (const fila of validas) {
    const s = fila.socio;
    if (!s) continue;
    const candidatos = s.dni
      ? existentes.filter((e) => e.dni === s.dni)
      : existentes.filter((e) => claveNombre(e.nombre, e.apellido) === claveNombre(s.nombre, s.apellido));
    if (candidatos.length > 1) {
      conflictos.push({
        numero: fila.numero,
        motivo: `Hay ${candidatos.length} socios con ese nombre y apellido: agregá el DNI para elegir cuál`,
      });
      continue;
    }
    const coincide = candidatos[0];
    if (!coincide) {
      acciones.push({ tipo: "crear", socio: s, numero: fila.numero });
      continue;
    }
    const previa = tocados.get(coincide.id);
    if (previa !== undefined) {
      conflictos.push({ numero: fila.numero, motivo: `Coincide con el mismo socio que la fila ${previa}` });
      continue;
    }
    tocados.set(coincide.id, fila.numero);
    // Un socio dado de baja se actualiza con los datos del archivo, pero sigue dado de baja.
    acciones.push({ tipo: "actualizar", socio: s, numero: fila.numero, clienteId: coincide.id, dadoDeBaja: !coincide.activo });
  }
  return { acciones, conflictos };
}

/** Contexto con la fecha de hoy (función aparte para que los tests puedan armar el suyo). */
export function contextoImportacion(codigoArea: string, planes: Plan[]): ContextoImportacion {
  return { planes, codigoArea, hoy: hoyISO() };
}

/** Campos asignados a más de una columna (el mismo dato no puede venir de dos lugares). */
export function camposRepetidos(mapeo: MapeoColumnas): CampoImportable[] {
  const vistos = new Set<CampoImportable>();
  const repetidos = new Set<CampoImportable>();
  for (const c of mapeo) {
    if (c === null) continue;
    if (vistos.has(c)) repetidos.add(c);
    vistos.add(c);
  }
  return [...repetidos];
}
