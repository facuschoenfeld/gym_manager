/**
 * Teléfonos argentinos -> formato internacional para WhatsApp: 549 + código de área + número.
 * Un número nacional argentino tiene 10 dígitos (código de área + abonado), por ejemplo
 * 11 + 8 dígitos, 351 + 7 dígitos, 2954 + 6 dígitos.
 */

export type ResultadoTelefono =
  | { ok: true; telefono: string }
  | { ok: false; motivo: string };

/**
 * Si el número tiene 12 dígitos, probablemente incluye el "15" de celular después del
 * código de área (ej. 351 15 1234567). Se prueba con códigos de 2, 3 y 4 dígitos.
 */
function quitarQuince(digitos: string): string {
  if (digitos.length !== 12) return digitos;
  for (const largoArea of [2, 3, 4]) {
    if (digitos.slice(largoArea, largoArea + 2) === "15") {
      return digitos.slice(0, largoArea) + digitos.slice(largoArea + 2);
    }
  }
  return digitos;
}

/**
 * Normaliza un teléfono escrito de cualquier forma:
 * "+54 9 351 123-4567", "0351 15 123 4567", "351-1234567", "1234567" (con área por defecto)...
 * @param codigoAreaPorDefecto se antepone cuando el número no trae código de área (ej. "351").
 */
export function normalizarTelefono(
  entrada: string | number | null | undefined,
  codigoAreaPorDefecto = "",
): ResultadoTelefono {
  let d = String(entrada ?? "").replace(/\D/g, "");
  if (d === "") return { ok: false, motivo: "Sin teléfono" };

  if (d.startsWith("00")) d = d.slice(2); // prefijo internacional 00
  if (d.startsWith("54") && d.length >= 12) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  } else if (d.startsWith("0")) {
    d = d.slice(1); // prefijo de larga distancia nacional
  }

  d = quitarQuince(d);

  // Sin código de área: "15" + número local, o número local solo.
  if (d.length < 10) {
    if (d.startsWith("15") && d.length >= 8) d = d.slice(2);
    const area = codigoAreaPorDefecto.replace(/\D/g, "").replace(/^0/, "");
    if (area && area.length + d.length === 10) d = area + d;
  }

  if (d.length !== 10) {
    return {
      ok: false,
      motivo:
        d.length < 10
          ? "Faltan dígitos o el código de área"
          : "Tiene demasiados dígitos para un número argentino",
    };
  }
  return { ok: true, telefono: `549${d}` };
}

/** Un teléfono ya guardado es usable para WhatsApp si tiene el formato 549 + 10 dígitos. */
export function esTelefonoWhatsApp(telefono: string | null | undefined): boolean {
  return !!telefono && /^549\d{10}$/.test(telefono);
}

/** "5493511234567" -> "+54 9 351 123-4567" (aproximado; el largo del área varía). */
export function formatearTelefono(telefono: string | null | undefined): string {
  if (!telefono) return "—";
  if (!esTelefonoWhatsApp(telefono)) return telefono;
  const n = telefono.slice(3);
  const area = n.startsWith("11") ? n.slice(0, 2) : n.slice(0, 3);
  const resto = n.slice(area.length);
  return `+54 9 ${area} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}
