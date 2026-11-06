import { describe, expect, it } from "vitest";
import type { SocioConEstado } from "@/features/socios/logica/socio";
import type { EstadoSocio } from "@/lib/estado";
import {
  armarMensajeAviso,
  contarEstados,
  filasExcelDeudores,
  listarDeudores,
  montoParaAviso,
  PLANTILLA_AVISO_POR_DEFECTO,
  urlWhatsapp,
} from "./deudores";

function socio(id: number, estado: EstadoSocio, diasParaVencer: number | null, activo = true): SocioConEstado {
  return {
    id,
    nombre: `Socio ${id}`,
    apellido: null,
    dni: null,
    email: null,
    telefono: null,
    planId: null,
    planNombre: null,
    planMonto: null,
    fechaAlta: "2026-01-01",
    activo,
    notas: null,
    venceEl: null,
    ultimoAviso: null,
    estado,
    diasParaVencer,
  };
}

describe("contarEstados", () => {
  it("cuenta cada estado y devuelve 0 para los que no hay", () => {
    const c = contarEstados([socio(1, "pago", 10), socio(2, "vencido", -3), socio(3, "vencido", -1)]);
    expect(c).toEqual({ pago: 1, por_vencer: 0, vencido: 2, sin_pagos: 0 });
  });

  it("lista vacía: todo en cero", () => {
    expect(contarEstados([])).toEqual({ pago: 0, por_vencer: 0, vencido: 0, sin_pagos: 0 });
  });

  it("no cuenta a los socios dados de baja", () => {
    const c = contarEstados([socio(1, "vencido", -3, false), socio(2, "pago", 10)]);
    expect(c).toEqual({ pago: 1, por_vencer: 0, vencido: 0, sin_pagos: 0 });
  });
});

describe("listarDeudores", () => {
  it("deja solo vencidos y por vencer, con los vencidos primero y los más atrasados arriba", () => {
    const lista = listarDeudores([
      socio(1, "pago", 20),
      socio(2, "por_vencer", 2),
      socio(3, "vencido", -1),
      socio(4, "sin_pagos", null),
      socio(5, "vencido", -10),
      socio(6, "por_vencer", -1), // dentro de la gracia
    ]);
    expect(lista.map((s) => s.id)).toEqual([5, 3, 6, 2]);
  });

  it("no incluye a los socios dados de baja aunque estén vencidos", () => {
    const lista = listarDeudores([socio(1, "vencido", -30, false), socio(2, "vencido", -2)]);
    expect(lista.map((s) => s.id)).toEqual([2]);
  });
});

describe("montoParaAviso", () => {
  it("un precio mayor que cero se usa; 0 y null no", () => {
    expect(montoParaAviso(15000)).toBe(15000);
    expect(montoParaAviso(0)).toBeNull();
    expect(montoParaAviso(null)).toBeNull();
  });
});

describe("armarMensajeAviso", () => {
  const datos = { nombre: "Ana", gimnasio: "Gym Centro", venceEl: "2026-11-03", monto: 1550000 };

  it("reemplaza los cuatro marcadores", () => {
    const texto = armarMensajeAviso("Hola {nombre}, de {gimnasio}: venció el {vencimiento}, {monto}.", datos);
    expect(texto).toBe("Hola Ana, de Gym Centro: venció el 03/11/2026, $ 15.500.");
  });

  it("sin monto deja el marcador vacío", () => {
    expect(armarMensajeAviso("Monto: {monto}", { ...datos, monto: null })).toBe("Monto: ");
  });

  it("sin fecha de vencimiento muestra guion", () => {
    expect(armarMensajeAviso("Venció {vencimiento}", { ...datos, venceEl: null })).toBe("Venció —");
  });

  it("una plantilla vacía usa el texto por defecto", () => {
    const texto = armarMensajeAviso("   ", datos);
    expect(texto).toBe(armarMensajeAviso(PLANTILLA_AVISO_POR_DEFECTO, datos));
    expect(texto).toContain("Ana");
  });

  it("los marcadores desconocidos se dejan tal cual", () => {
    expect(armarMensajeAviso("Hola {apodo}", datos)).toBe("Hola {apodo}");
  });
});

describe("urlWhatsapp", () => {
  it("arma el link wa.me con el texto codificado", () => {
    expect(urlWhatsapp("5493482123456", "Hola & chau ¡sí!")).toBe(
      "https://wa.me/5493482123456?text=Hola%20%26%20chau%20%C2%A1s%C3%AD!",
    );
  });
});

describe("filasExcelDeudores", () => {
  it("encabezado y una fila por deudor, con fechas y etiquetas en texto", () => {
    const d = {
      ...socio(1, "vencido", -3),
      apellido: "Gómez",
      nombre: "Ana",
      telefono: "5493511234567",
      venceEl: "2026-11-03",
      planNombre: "Mensual",
      ultimoAviso: "2026-11-01 10:00:00",
    };
    const filas = filasExcelDeudores([d], "2026-11-06");
    expect(filas[0]).toEqual(["Socio", "Teléfono", "Estado", "Vencimiento", "Situación", "Plan", "Último aviso"]);
    expect(filas[1]).toEqual([
      "Gómez, Ana",
      "5493511234567",
      "Vencido",
      "03/11/2026",
      "Venció hace 3 días",
      "Mensual",
      "01/11/2026",
    ]);
  });
});
