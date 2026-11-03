import { describe, expect, it } from "vitest";
import {
  capitalizarNombre,
  claveNombre,
  coincideBusqueda,
  formatearDni,
  limpiarEspacios,
  normalizarBusqueda,
  normalizarDni,
} from "./texto";

describe("limpiarEspacios", () => {
  const espacioDuro = String.fromCharCode(0xa0);
  it("colapsa y recorta (incluye espacio duro)", () =>
    expect(limpiarEspacios(`  Juan \t  Pérez${espacioDuro} `)).toBe("Juan Pérez"));
  it("null -> vacío", () => expect(limpiarEspacios(null)).toBe(""));
});

describe("capitalizarNombre", () => {
  it.each([
    ["  jUAN   carlos ", "Juan Carlos"],
    ["MARÍA JOSÉ", "María José"],
    ["juan de la cruz", "Juan de la Cruz"],
    ["de la fuente", "De la Fuente"],
    ["maría-josé", "María-José"],
    ["o'connor", "O'Connor"],
    ["ñuñez", "Ñuñez"],
    ["", ""],
  ])("%s -> %s", (v, esperado) => expect(capitalizarNombre(v)).toBe(esperado));
});

describe("búsqueda", () => {
  it("normaliza acentos y mayúsculas", () => expect(normalizarBusqueda(" Peña  JOSÉ ")).toBe("pena jose"));
  it("encuentra por nombre, apellido o DNI, en cualquier orden", () => {
    const campos = ["José", "Peña", "30123456"] as const;
    expect(coincideBusqueda("pena", ...campos)).toBe(true);
    expect(coincideBusqueda("jose peña", ...campos)).toBe(true);
    expect(coincideBusqueda("peña jo", ...campos)).toBe(true);
    expect(coincideBusqueda("30123", ...campos)).toBe(true);
    expect(coincideBusqueda("30.123.456", ...campos)).toBe(true);
    expect(coincideBusqueda("", ...campos)).toBe(true);
    expect(coincideBusqueda("gomez", ...campos)).toBe(false);
  });
  it("tolera campos nulos", () => expect(coincideBusqueda("ana", "Ana", null, undefined)).toBe(true));
});

describe("normalizarDni", () => {
  it.each<[string | number | null, string | null]>([
    ["30.123.456", "30123456"],
    [" 30 123 456 ", "30123456"],
    [30123456, "30123456"],
    ["30123456.0", "30123456"],
    ["5.123.456", "5123456"],
    ["", null],
    [null, null],
  ])("%s -> %s", (v, esperado) => expect(normalizarDni(v)).toEqual({ ok: true, dni: esperado }));

  it.each(["abc", "123", "1234567890"])("rechaza %s", (v) => expect(normalizarDni(v).ok).toBe(false));
  it.each(["000000", "0000001", "00012345"])("los ceros a la izquierda no cuentan como dígitos: rechaza %s", (v) => {
    expect(normalizarDni(v).ok).toBe(false);
  });
  it("con ceros a la izquierda y suficientes dígitos los quita", () => {
    expect(normalizarDni("012345678")).toEqual({ ok: true, dni: "12345678" });
  });
});

describe("otros", () => {
  it("formatearDni", () => expect(formatearDni("30123456")).toBe("30.123.456"));
  it("claveNombre ignora acentos, mayúsculas y espacios", () => {
    expect(claveNombre("José ", "PEÑA")).toBe(claveNombre("jose", "pena"));
  });
});
