import { describe, expect, it } from "vitest";
import { calcularNuevoVencimiento, type DatosNuevoVencimiento } from "./vencimiento";

const base: DatosNuevoVencimiento = {
  regla: "desde_vencimiento_anterior",
  fechaPago: "2026-11-02",
  venceElAnterior: null,
  periodo: "mes",
  cantidad: 1,
  diasGracia: 0,
};

describe("regla desde_vencimiento_anterior", () => {
  it("sin pagos previos: desde la fecha de pago", () => {
    expect(calcularNuevoVencimiento(base)).toBe("2026-12-02");
  });
  it("al día (paga antes de vencer): continúa desde el vencimiento anterior", () => {
    expect(calcularNuevoVencimiento({ ...base, venceElAnterior: "2026-11-10" })).toBe("2026-12-10");
  });
  it("paga el mismo día que vence: continúa", () => {
    expect(calcularNuevoVencimiento({ ...base, venceElAnterior: "2026-11-02" })).toBe("2026-12-02");
  });
  it("vencido: arranca desde la fecha de pago", () => {
    expect(calcularNuevoVencimiento({ ...base, venceElAnterior: "2026-10-15" })).toBe("2026-12-02");
  });
  it("dentro de los días de gracia: continúa desde el vencimiento anterior (no gana días)", () => {
    expect(
      calcularNuevoVencimiento({ ...base, venceElAnterior: "2026-10-31", diasGracia: 3 }),
    ).toBe("2026-11-30");
  });
  it("pasada la gracia: desde la fecha de pago", () => {
    expect(
      calcularNuevoVencimiento({ ...base, venceElAnterior: "2026-10-29", diasGracia: 3 }),
    ).toBe("2026-12-02");
  });
  it("pago por adelantado de un plan semanal", () => {
    expect(
      calcularNuevoVencimiento({ ...base, periodo: "semana", venceElAnterior: "2026-11-05" }),
    ).toBe("2026-11-12");
  });
});

describe("regla desde_fecha_pago", () => {
  it("ignora el vencimiento anterior", () => {
    expect(
      calcularNuevoVencimiento({ ...base, regla: "desde_fecha_pago", venceElAnterior: "2026-11-20" }),
    ).toBe("2026-12-02");
  });
  it("pase diario", () => {
    expect(calcularNuevoVencimiento({ ...base, regla: "desde_fecha_pago", periodo: "dia" })).toBe(
      "2026-11-03",
    );
  });
});
