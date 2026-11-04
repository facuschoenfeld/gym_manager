import { describe, expect, it } from "vitest";
import type { Plan } from "@/features/planes/logica/plan";
import {
  crearEsquemaPago,
  esquemaAnulacion,
  FORMULARIO_PAGO_VACIO,
  hayPagosPosteriores,
  pagoDelMismoDia,
  planPorDefectoParaPago,
  venceElSinPago,
  type FormularioPago,
} from "./pago";

const HOY = "2026-11-03";

const valido: FormularioPago = {
  planId: "3",
  monto: "15.000",
  fechaPago: "2026-11-02",
  medio: "transferencia",
  referencia: "  op 123  ",
};

const esquema = crearEsquemaPago(HOY);

describe("crearEsquemaPago", () => {
  it("convierte el formulario a tipos de base: id numérico, monto en centavos, referencia limpia", () => {
    const r = esquema.safeParse(valido);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({
      planId: 3,
      monto: 1_500_000,
      fechaPago: "2026-11-02",
      medio: "transferencia",
      referencia: "op 123",
    });
  });

  it("acepta monto 0 (planes con precio 0, pagos sin cargo)", () => {
    const r = esquema.safeParse({ ...valido, monto: "0" });
    expect(r.success && r.data.monto).toBe(0);
  });

  it("acepta la fecha de hoy", () => {
    expect(esquema.safeParse({ ...valido, fechaPago: HOY }).success).toBe(true);
  });

  it("rechaza fechas futuras", () => {
    const r = esquema.safeParse({ ...valido, fechaPago: "2026-11-04" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("La fecha de pago no puede ser futura");
  });

  it("rechaza fechas inexistentes", () => {
    expect(esquema.safeParse({ ...valido, fechaPago: "2026-02-31" }).success).toBe(false);
    expect(esquema.safeParse({ ...valido, fechaPago: "" }).success).toBe(false);
  });

  it("rechaza montos inválidos, negativos y excesivos", () => {
    for (const monto of ["", "abc", "-100", "1.5.5"]) {
      expect(esquema.safeParse({ ...valido, monto }).success).toBe(false);
    }
    expect(esquema.safeParse({ ...valido, monto: "200000000" }).success).toBe(false);
  });

  it("exige un plan elegido", () => {
    expect(esquema.safeParse({ ...valido, planId: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...valido, planId: "abc" }).success).toBe(false);
  });

  it("exige un medio de pago válido", () => {
    expect(esquema.safeParse({ ...valido, medio: "tarjeta" as never }).success).toBe(false);
  });

  it("la referencia es opcional: vacía o solo espacios queda en null", () => {
    const r = esquema.safeParse({ ...FORMULARIO_PAGO_VACIO, planId: "1", monto: "0", fechaPago: HOY, referencia: "   " });
    expect(r.success && r.data.referencia).toBe(null);
  });

  it("rechaza referencias demasiado largas", () => {
    expect(esquema.safeParse({ ...valido, referencia: "x".repeat(101) }).success).toBe(false);
    expect(esquema.safeParse({ ...valido, referencia: "x".repeat(100) }).success).toBe(true);
  });
});

describe("crearEsquemaPago: bordes de monto", () => {
  const centavosDe = (monto: string) => {
    const r = esquema.safeParse({ ...valido, monto });
    return r.success ? r.data.monto : null;
  };

  it("convierte montos con decimales a centavos enteros", () => {
    expect(centavosDe("0,5")).toBe(50);
    expect(centavosDe("15.000,50")).toBe(1_500_050);
    expect(centavosDe("$ 15.000")).toBe(1_500_000);
    for (const m of ["0,5", "15.000,50", "0,01"]) {
      expect(Number.isInteger(centavosDe(m))).toBe(true);
    }
  });

  it("acepta exactamente el máximo ($ 100.000.000) y rechaza un centavo más", () => {
    expect(centavosDe("100000000")).toBe(10_000_000_000);
    expect(centavosDe("100000000,01")).toBe(null);
  });

  it("rechaza más de dos decimales", () => {
    expect(centavosDe("10,999")).toBe(null);
  });
});

describe("crearEsquemaPago: bordes de fecha", () => {
  const conFecha = (fechaPago: string) => esquema.safeParse({ ...valido, fechaPago });

  it("rechaza el 29/02 de un año no bisiesto y acepta el de uno bisiesto", () => {
    expect(conFecha("2026-02-29").success).toBe(false);
    expect(conFecha("2024-02-29").success).toBe(true);
  });

  it("rechaza formatos que no son ISO", () => {
    expect(conFecha("03/11/2026").success).toBe(false);
  });

  it("el día anterior a hoy es válido y el siguiente no (límite exacto)", () => {
    expect(conFecha("2026-11-02").success).toBe(true);
    expect(conFecha("2026-11-03").success).toBe(true);
    expect(conFecha("2026-11-04").success).toBe(false);
  });

  it("el límite depende del 'hoy' recibido, incluso en fin de año", () => {
    const e = crearEsquemaPago("2026-12-31");
    expect(e.safeParse({ ...valido, fechaPago: "2026-12-31" }).success).toBe(true);
    expect(e.safeParse({ ...valido, fechaPago: "2027-01-01" }).success).toBe(false);
  });
});

describe("crearEsquemaPago: bordes de referencia y medio", () => {
  it("la referencia de 100 caracteres es válida y la de 101 no, midiendo después de limpiar espacios", () => {
    expect(esquema.safeParse({ ...valido, referencia: `  ${"x".repeat(100)}  ` }).success).toBe(true);
    expect(esquema.safeParse({ ...valido, referencia: `  ${"x".repeat(101)}  ` }).success).toBe(false);
  });

  it("acepta ambos medios", () => {
    expect(esquema.safeParse({ ...valido, medio: "efectivo" }).success).toBe(true);
    expect(esquema.safeParse({ ...valido, medio: "transferencia" }).success).toBe(true);
  });

  it("rechaza el formulario vacío por defecto", () => {
    expect(esquema.safeParse(FORMULARIO_PAGO_VACIO).success).toBe(false);
  });
});

describe("esquemaAnulacion", () => {
  it("el motivo de 100 caracteres es válido y el de 101 no", () => {
    expect(esquemaAnulacion.safeParse({ motivo: "m".repeat(100) }).success).toBe(true);
    expect(esquemaAnulacion.safeParse({ motivo: "m".repeat(101) }).success).toBe(false);
  });

  it("exige un motivo con texto", () => {
    expect(esquemaAnulacion.safeParse({ motivo: "" }).success).toBe(false);
    expect(esquemaAnulacion.safeParse({ motivo: "   " }).success).toBe(false);
  });

  it("limpia los espacios del motivo", () => {
    const r = esquemaAnulacion.safeParse({ motivo: "  cargado dos veces  " });
    expect(r.success && r.data.motivo).toBe("cargado dos veces");
  });
});

const plan = (id: number, periodo: Plan["periodo"], cantidad: number, activo = true): Plan => ({
  id,
  nombre: `Plan ${id}`,
  periodo,
  cantidad,
  monto: 0,
  activo,
});

describe("planPorDefectoParaPago", () => {
  const planes = [plan(1, "dia", 1), plan(2, "semana", 1), plan(3, "mes", 1), plan(4, "mes", 3)];

  it("propone el plan actual del socio", () => {
    expect(planPorDefectoParaPago(planes, 4)?.id).toBe(4);
  });

  it("propone el plan actual aunque esté inactivo", () => {
    const conInactivo = [plan(1, "dia", 1), plan(2, "mes", 1, false)];
    expect(planPorDefectoParaPago(conInactivo, 2)?.id).toBe(2);
  });

  it("si el socio no tiene plan, propone el mensual de 1 mes", () => {
    expect(planPorDefectoParaPago(planes, null)?.id).toBe(3);
  });

  it("si no hay mensual activo, propone el primero activo", () => {
    const sinMensual = [plan(1, "dia", 1), plan(2, "semana", 1, false)];
    expect(planPorDefectoParaPago(sinMensual, null)?.id).toBe(1);
  });

  it("devuelve null si no hay planes activos", () => {
    expect(planPorDefectoParaPago([plan(1, "mes", 1, false)], null)).toBe(null);
  });

  it("devuelve null si la lista de planes está vacía", () => {
    expect(planPorDefectoParaPago([], null)).toBe(null);
    expect(planPorDefectoParaPago([], 5)).toBe(null);
  });

  it("ignora el mensual inactivo y propone el primer activo", () => {
    const lista = [plan(1, "mes", 1, false), plan(2, "semana", 1), plan(3, "mes", 3)];
    expect(planPorDefectoParaPago(lista, null)?.id).toBe(2);
  });

  it("si el plan actual del socio ya no existe en la lista, cae al mensual", () => {
    expect(planPorDefectoParaPago(planes, 999)?.id).toBe(3);
  });
});

describe("venceElSinPago", () => {
  // fechaPago crece con el id: el pago 2 es posterior al 1.
  const p = (id: number, venceEl: string, anulado = false) => ({
    id,
    fechaPago: `2026-01-${String(id).padStart(2, "0")}`,
    venceEl,
    anulado,
  });

  it("devuelve el vencimiento más lejano de los pagos que quedan", () => {
    const pagos = [p(1, "2026-10-01"), p(2, "2026-11-01"), p(3, "2026-09-01")];
    expect(venceElSinPago(pagos, 2)).toBe("2026-10-01");
    expect(venceElSinPago(pagos, 1)).toBe("2026-11-01");
  });

  it("ignora los pagos ya anulados", () => {
    const pagos = [p(1, "2026-10-01"), p(2, "2026-12-01", true)];
    expect(venceElSinPago(pagos, 1)).toBe(null);
  });

  it("con un id que no existe devuelve el máximo de todos los pagos vigentes", () => {
    expect(venceElSinPago([p(1, "2026-10-01"), p(2, "2026-11-01")], 99)).toBe("2026-11-01");
  });

  it("devuelve null si el pago anulado era el único vigente", () => {
    expect(venceElSinPago([p(1, "2026-10-01")], 1)).toBe(null);
  });
});

describe("hayPagosPosteriores", () => {
  const p = (id: number, fechaPago: string, anulado = false) => ({ id, fechaPago, venceEl: fechaPago, anulado });

  it("es false si el pago anulado es el último", () => {
    expect(hayPagosPosteriores([p(1, "2026-10-03"), p(2, "2026-11-01")], 2)).toBe(false);
  });

  it("es true si hay un pago posterior vigente", () => {
    expect(hayPagosPosteriores([p(1, "2026-10-03"), p(2, "2026-11-01")], 1)).toBe(true);
  });

  it("ignora los posteriores ya anulados", () => {
    expect(hayPagosPosteriores([p(1, "2026-10-03"), p(2, "2026-11-01", true)], 1)).toBe(false);
  });

  it("con la misma fecha, cuenta como posterior el de id mayor", () => {
    expect(hayPagosPosteriores([p(1, "2026-11-01"), p(2, "2026-11-01")], 1)).toBe(true);
    expect(hayPagosPosteriores([p(1, "2026-11-01"), p(2, "2026-11-01")], 2)).toBe(false);
  });

  it("es false si el id no existe", () => {
    expect(hayPagosPosteriores([p(1, "2026-10-03")], 99)).toBe(false);
  });
});

describe("pagoDelMismoDia", () => {
  const p = (id: number, fechaPago: string, anulado = false) => ({ id, fechaPago, venceEl: fechaPago, anulado });

  it("devuelve el pago vigente de esa fecha", () => {
    expect(pagoDelMismoDia([p(1, "2026-11-02"), p(2, "2026-11-03")], "2026-11-03")?.id).toBe(2);
  });

  it("devuelve null si no hay pagos en esa fecha", () => {
    expect(pagoDelMismoDia([p(1, "2026-11-02")], "2026-11-03")).toBe(null);
  });

  it("ignora un pago anulado de esa fecha (se puede volver a registrar)", () => {
    expect(pagoDelMismoDia([p(1, "2026-11-03", true)], "2026-11-03")).toBe(null);
  });

  it("sin pagos devuelve null", () => {
    expect(pagoDelMismoDia([], "2026-11-03")).toBe(null);
  });
});
