import { describe, expect, it } from "vitest";
import { calcularEstado, describirVencimiento, diasDeAtraso, diasParaVencer } from "./estado";

const HOY = "2026-11-02";
const cfg = { diasPorVencer: 5, diasGracia: 0 };

describe("calcularEstado", () => {
  it("sin pagos", () => expect(calcularEstado(null, HOY, cfg)).toBe("sin_pagos"));
  it("pago: vence más allá de la ventana de aviso", () => {
    expect(calcularEstado("2026-11-08", HOY, cfg)).toBe("pago");
  });
  it("por vencer: dentro de los próximos 5 días (inclusive)", () => {
    expect(calcularEstado("2026-11-07", HOY, cfg)).toBe("por_vencer");
    expect(calcularEstado("2026-11-03", HOY, cfg)).toBe("por_vencer");
  });
  it("el día del vencimiento todavía es 'por vencer'", () => {
    expect(calcularEstado(HOY, HOY, cfg)).toBe("por_vencer");
  });
  it("vencido desde el día siguiente", () => {
    expect(calcularEstado("2026-11-01", HOY, cfg)).toBe("vencido");
  });

  describe("con días de gracia", () => {
    const conGracia = { diasPorVencer: 5, diasGracia: 3 };
    it("dentro de la gracia sigue 'por vencer'", () => {
      expect(calcularEstado("2026-10-30", HOY, conGracia)).toBe("por_vencer");
    });
    it("pasada la gracia queda vencido", () => {
      expect(calcularEstado("2026-10-29", HOY, conGracia)).toBe("vencido");
    });
  });

  it("con 0 días para 'por vencer', solo el día del vencimiento", () => {
    const c = { diasPorVencer: 0, diasGracia: 0 };
    expect(calcularEstado("2026-11-03", HOY, c)).toBe("pago");
    expect(calcularEstado(HOY, HOY, c)).toBe("por_vencer");
  });
});

describe("días", () => {
  it("diasParaVencer", () => {
    expect(diasParaVencer("2026-11-05", HOY)).toBe(3);
    expect(diasParaVencer("2026-10-28", HOY)).toBe(-5);
    expect(diasParaVencer(null, HOY)).toBeNull();
  });
  it("diasDeAtraso nunca es negativo", () => {
    expect(diasDeAtraso("2026-10-28", HOY)).toBe(5);
    expect(diasDeAtraso("2026-11-05", HOY)).toBe(0);
    expect(diasDeAtraso(null, HOY)).toBe(0);
  });
  it.each([
    [null, "Sin pagos registrados"],
    ["2026-11-02", "Vence hoy"],
    ["2026-11-03", "Vence mañana"],
    ["2026-11-06", "Vence en 4 días"],
    ["2026-11-01", "Venció ayer"],
    ["2026-10-20", "Venció hace 13 días"],
  ])("describirVencimiento(%s) = %s", (v, esperado) => {
    expect(describirVencimiento(v, HOY)).toBe(esperado);
  });
});
