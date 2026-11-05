/**
 * Logo del gimnasio: reglas puras (validación del archivo, escalado y forma de la data URL guardada).
 * El trabajo con el navegador (leer el archivo, dibujarlo en un canvas) está en imagenLogo.ts.
 *
 * Por qué no SVG: puede contener scripts y referencias externas. Solo se aceptan mapas de bits.
 */

export const TIPOS_LOGO_ACEPTADOS = ["image/png", "image/jpeg", "image/webp"] as const;
export type TipoLogo = (typeof TIPOS_LOGO_ACEPTADOS)[number];

/** Tamaño máximo del archivo elegido (antes de achicarlo). */
export const MAX_BYTES_ORIGEN = 10 * 1024 * 1024;
/** Mayor dimensión del logo guardado. Un logo no necesita más para verse bien en pantalla. */
export const LADO_MAX_LOGO = 512;
/** Tope de píxeles de la imagen original: evita decodificar algo que colgaría la ventana (PC de 8 GB). */
export const MAX_PIXELES_ORIGEN = 25_000_000;
/** Tope de la data URL guardada (ya escalada). Evita que la tabla config crezca sin control. */
export const MAX_CARACTERES_DATA_URL = 400_000;

export type ResultadoValidacion = { ok: true } | { ok: false; motivo: string };

export function validarArchivoLogo(archivo: { type: string; size: number }): ResultadoValidacion {
  if (archivo.size === 0) return { ok: false, motivo: "El archivo está vacío." };
  if (!(TIPOS_LOGO_ACEPTADOS as readonly string[]).includes(archivo.type)) {
    return { ok: false, motivo: "Elegí una imagen PNG, JPG o WebP. Los archivos SVG no se aceptan." };
  }
  if (archivo.size > MAX_BYTES_ORIGEN) {
    return { ok: false, motivo: "La imagen pesa más de 10 MB. Probá con una más chica." };
  }
  return { ok: true };
}

/**
 * Tamaño al que se achica el logo: conserva la proporción, nunca agranda y no baja de 1 px.
 * Lanza error si las dimensiones no son válidas (una imagen real siempre tiene tamaño).
 */
export function calcularDimensionesLogo(
  ancho: number,
  alto: number,
  ladoMax: number = LADO_MAX_LOGO,
): { ancho: number; alto: number } {
  if (!(ancho > 0) || !(alto > 0) || !Number.isFinite(ancho) || !Number.isFinite(alto)) {
    throw new Error(`Dimensiones inválidas: ${ancho}×${alto}`);
  }
  const escala = Math.min(1, ladoMax / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** ¿La imagen original tiene demasiados píxeles para decodificarla con seguridad? */
export function excedeLimitePixeles(ancho: number, alto: number): boolean {
  return ancho * alto > MAX_PIXELES_ORIGEN;
}

const RE_DATA_URL_LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * ¿El valor es una data URL de logo que podemos mostrar? Se revisa al guardar y al leer:
 * si la tabla config se editó a mano o llegó de un respaldo, algo raro no llega a un <img>.
 */
export function esDataUrlLogoValida(valor: string): boolean {
  return valor.length <= MAX_CARACTERES_DATA_URL && RE_DATA_URL_LOGO.test(valor);
}

/**
 * Formato con que se exporta el logo ya escalado. PNG y WebP se guardan como PNG para conservar
 * la transparencia; JPG como JPEG (no tiene transparencia).
 */
export function formatoSalida(tipoOrigen: string): "image/png" | "image/jpeg" {
  return tipoOrigen === "image/jpeg" ? "image/jpeg" : "image/png";
}

/** Lado más chico del segundo intento, si el primero queda demasiado pesado. */
export const LADO_MAX_LOGO_REDUCIDO = 384;

export interface PasoSalida {
  formato: "image/png" | "image/jpeg" | "image/webp";
  /** Calidad 0 a 1 (solo aplica a JPEG y WebP). */
  calidad: number;
  ladoMax: number;
}

/**
 * Intentos para exportar el logo, en orden, hasta que quepa en MAX_CARACTERES_DATA_URL.
 * PNG puede pesar mucho si tiene fotos o degradados; WebP suele quedar bastante más liviano.
 */
export function pasosDeSalida(tipoOrigen: string): PasoSalida[] {
  return [
    { formato: formatoSalida(tipoOrigen), calidad: 0.9, ladoMax: LADO_MAX_LOGO },
    { formato: "image/webp", calidad: 0.85, ladoMax: LADO_MAX_LOGO },
    { formato: "image/webp", calidad: 0.8, ladoMax: LADO_MAX_LOGO_REDUCIDO },
  ];
}

/** Fondo de la caja donde se muestra el logo: uno que contraste con él. */
export type FondoLogo = "claro" | "oscuro";

/**
 * Luminancia promedio (0 a 1) de los píxeles visibles de una imagen RGBA (4 bytes por píxel).
 * Los píxeles casi transparentes no cuentan: un logo con fondo transparente solo pesa su dibujo.
 * Devuelve null si no hay ningún píxel visible.
 */
export function luminanciaPromedio(rgba: ArrayLike<number>): number | null {
  let suma = 0;
  let cantidad = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const alpha = rgba[i + 3] ?? 0;
    if (alpha < 128) continue;
    // Luminancia perceptual (Rec. 709) sobre valores 0 a 1.
    const r = (rgba[i] ?? 0) / 255;
    const g = (rgba[i + 1] ?? 0) / 255;
    const b = (rgba[i + 2] ?? 0) / 255;
    suma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    cantidad++;
  }
  return cantidad > 0 ? suma / cantidad : null;
}

/**
 * Logo claro (letras blancas, por ejemplo) → caja oscura. Logo oscuro → caja clara.
 * Sin píxeles visibles, se usa la caja clara (la de siempre).
 */
export function fondoParaLuminancia(luminancia: number | null): FondoLogo {
  return luminancia !== null && luminancia > 0.5 ? "oscuro" : "claro";
}

/** Clases de la caja donde se muestra el logo: el fondo contrasta con el logo (ver fondoParaLuminancia). */
export function clasesCajaLogo(fondo: FondoLogo): string {
  // El oscuro es el mismo color que la barra lateral en modo oscuro (--sidebar en index.css), fijo en ambos temas.
  return fondo === "oscuro" ? "border-[oklch(0.3_0_0)] bg-[oklch(0.205_0_0)]" : "border-gray-200 bg-white";
}
