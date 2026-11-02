import { describe, expect, it } from "vitest";
import { centavosATexto, formatearPesos, parsearPesos, pesosACentavos } from "./dinero";

describe("formatearPesos", () => {
  it("sin decimales si son pesos enteros", () => expect(formatearPesos(1_500_000)).toBe("$ 15.000"));
  it("con decimales si hay centavos", () => expect(formatearPesos(1_500_050)).toBe("$ 15.000,50"));
  it("cero", () => expect(formatearPesos(0)).toBe("$ 0"));
});

describe("pesosACentavos", () => {
  it("evita errores de coma flotante", () => expect(pesosACentavos(0.1 + 0.2)).toBe(30));
});

describe("centavosATexto", () => {
  it.each([
    [1_500_000, "15000"],
    [1_500_050, "15000,50"],
    [5, "0,05"],
  ])("%s -> %s", (c, t) => expect(centavosATexto(c)).toBe(t));
});

describe("parsearPesos", () => {
  it.each<[string | number, number | null]>([
    [15000, 1_500_000],
    [15000.5, 1_500_050],
    ["15000", 1_500_000],
    ["15.000", 1_500_000],
    ["1.500.000", 150_000_000],
    ["$ 15.000,50", 1_500_050],
    ["15000,5", 1_500_050],
    ["15000.50", 1_500_050],
    ["15.5", 1_550],
    ["ARS 12.000", 1_200_000],
    ["", null],
    ["abc", null],
    ["-100", null],
    [-5, null],
    ["15,000,00", null],
  ])("%s -> %s", (v, esperado) => expect(parsearPesos(v)).toBe(esperado));
});
