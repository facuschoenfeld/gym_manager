/**
 * Dinero: SIEMPRE en centavos como entero. Solo se formatea al mostrar.
 */

const formatoSinDecimales = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatoConDecimales = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 1500000 -> "$ 15.000"; 1500050 -> "$ 15.000,50". */
export function formatearPesos(centavos: number): string {
  const f = centavos % 100 === 0 ? formatoSinDecimales : formatoConDecimales;
  // Intl usa un espacio duro (U+00A0) entre "$" y el número; lo normalizamos (\s lo incluye).
  return f.format(centavos / 100).replace(/\s/g, " ");
}

/** Pesos (número) -> centavos enteros, evitando errores de coma flotante. */
export function pesosACentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

/** Centavos -> texto editable en un input ("15000" o "15000,50"). */
export function centavosATexto(centavos: number): string {
  const pesos = Math.trunc(centavos / 100);
  const resto = Math.abs(centavos % 100);
  return resto === 0 ? String(pesos) : `${pesos},${String(resto).padStart(2, "0")}`;
}

/**
 * Interpreta un monto escrito por una persona o leído de un Excel y lo devuelve en centavos.
 * Acepta: 15000 | "15000" | "15.000" | "$ 15.000,50" | "15000,5" | "15000.50".
 * Regla: si hay coma, la coma es decimal y los puntos son miles. Sin coma, un punto
 * seguido de exactamente 3 dígitos es separador de miles; si no, es decimal.
 * Devuelve null si no es un monto válido (o es negativo).
 */
export function parsearPesos(valor: string | number): number | null {
  if (typeof valor === "number") {
    return Number.isFinite(valor) && valor >= 0 ? pesosACentavos(valor) : null;
  }
  let t = valor.replace(/\$|ARS|\s/gi, "");
  if (t === "") return null;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, "");
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return pesosACentavos(Number(t));
}
