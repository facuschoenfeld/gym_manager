import { describe, expect, it } from "vitest";
import {
  aISO,
  desdeSerialExcel,
  describirPeriodo,
  diferenciaDias,
  esFechaISOValida,
  formatearFecha,
  hoyISO,
  parsearFechaAR,
  rangoDelMes,
  sumarPeriodo,
} from "./fechas";

describe("hoyISO", () => {
  it("usa la fecha local, no UTC (a las 22:00 en Argentina sigue siendo el mismo día)", () => {
    const noche = new Date(2026, 10, 2, 22, 30); // 2/11/2026 22:30 hora local
    expect(hoyISO(noche)).toBe("2026-11-02");
  });
  it("aISO rellena con ceros", () => {
    expect(aISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("esFechaISOValida", () => {
  it.each([
    ["2026-02-28", true],
    ["2024-02-29", true],
    ["2026-02-29", false],
    ["2026-13-01", false],
    ["2026-1-01", false],
    ["01/02/2026", false],
  ])("%s -> %s", (v, esperado) => expect(esFechaISOValida(v)).toBe(esperado));
});

describe("formatearFecha", () => {
  it("muestra DD/MM/YYYY", () => expect(formatearFecha("2026-11-02")).toBe("02/11/2026"));
  it("acepta fecha+hora", () => expect(formatearFecha("2026-11-02 10:30:00")).toBe("02/11/2026"));
  it("vacío -> guion", () => expect(formatearFecha(null)).toBe("—"));
});

describe("parsearFechaAR", () => {
  it.each([
    ["15/10/2026", "2026-10-15"],
    ["5/3/2026", "2026-03-05"],
    ["05-03-2026", "2026-03-05"],
    ["05.03.2026", "2026-03-05"],
    ["5/3/26", "2026-03-05"],
    ["5/3/98", "1998-03-05"],
    ["2026-03-05", "2026-03-05"],
    [" 15/10/2026 ", "2026-10-15"],
  ])("%s -> %s", (v, esperado) => expect(parsearFechaAR(v)).toBe(esperado));

  it.each(["31/02/2026", "29/02/2026", "00/01/2026", "15/13/2026", "hola", "", "15/10"])(
    "rechaza %s",
    (v) => expect(parsearFechaAR(v)).toBeNull(),
  );
});

describe("desdeSerialExcel", () => {
  it.each([
    [45962, "2025-11-01"],
    [46328, "2026-11-02"],
    [45962.75, "2025-11-01"], // con hora
  ])("%s -> %s", (serial, esperado) => expect(desdeSerialExcel(serial)).toBe(esperado));
  it("rechaza valores fuera de rango", () => {
    expect(desdeSerialExcel(0)).toBeNull();
    expect(desdeSerialExcel(Number.NaN)).toBeNull();
  });
});

describe("sumarPeriodo", () => {
  it("mes calendario: 15/10 -> 15/11", () => expect(sumarPeriodo("2026-10-15", "mes")).toBe("2026-11-15"));
  it("31/01 -> último día de febrero", () => {
    expect(sumarPeriodo("2026-01-31", "mes")).toBe("2026-02-28");
    expect(sumarPeriodo("2028-01-31", "mes")).toBe("2028-02-29");
  });
  it("cruza de año", () => expect(sumarPeriodo("2026-12-10", "mes")).toBe("2027-01-10"));
  it("trimestral", () => expect(sumarPeriodo("2026-11-30", "mes", 3)).toBe("2027-02-28"));
  it("semana", () => expect(sumarPeriodo("2026-12-28", "semana")).toBe("2027-01-04"));
  it("día", () => expect(sumarPeriodo("2026-02-28", "dia")).toBe("2026-03-01"));
});

describe("otras", () => {
  it("diferenciaDias", () => {
    expect(diferenciaDias("2026-11-01", "2026-11-11")).toBe(10);
    expect(diferenciaDias("2026-11-11", "2026-11-01")).toBe(-10);
  });
  it("rangoDelMes", () => {
    expect(rangoDelMes("2026-02-14")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });
  it("describirPeriodo", () => {
    expect(describirPeriodo("mes", 1)).toBe("1 mes");
    expect(describirPeriodo("mes", 3)).toBe("3 meses");
  });
});
