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
  it.each([".", "...", " . . "])("una búsqueda de solo puntos no coincide con nadie: %s", (q) => {
    expect(coincideBusqueda(q, "José", "Peña", "30123456")).toBe(false);
  });
  it.each(["pena .", ". jose", "jose ... pena"])("las palabras de solo puntos se ignoran: %s", (q) => {
    expect(coincideBusqueda(q, "José", "Peña", "30123456")).toBe(true);
  });
  it("ignorar los puntos no hace coincidir lo que no coincide", () => {
    expect(coincideBusqueda("gomez .", "José", "Peña", "30123456")).toBe(false);
  });
  it("solo espacios equivale a no buscar", () => expect(coincideBusqueda("   ", "José", "Peña")).toBe(true));
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
  it.each(["30.100.000", "30 100 000", "30100000.0", "30100000"])("no confunde miles con decimales: %s", (v) => {
    expect(normalizarDni(v)).toEqual({ ok: true, dni: "30100000" });
  });
  it.each([
    "3.0.1.2.3.4.5",
    "30..123.456",
    "30123456.",
    ".30123456",
    "30.12.3456",
    "30-123-456",
    "30,123,456",
    "30.123 456",
    "DNI 30123456",
  ])("rechaza puntuación mal puesta: %s", (v) => {
    expect(normalizarDni(v).ok).toBe(false);
  });
  it.each(["000000", "0000001", "00012345"])("los ceros a la izquierda no cuentan como dígitos: rechaza %s", (v) => {
    expect(normalizarDni(v).ok).toBe(false);
  });
  it("con ceros a la izquierda y suficientes dígitos los quita", () => {
    expect(normalizarDni("012345678")).toEqual({ ok: true, dni: "12345678" });
  });
});

describe("normalizarDni: bordes adicionales", () => {
  it.each<[string | number, string]>([
    ["123.456", "123456"], // 6 dígitos con puntos
    ["123.456.789", "123456789"], // 9 dígitos con puntos
    ["30123456.00", "30123456"], // decimal de Excel con varios ceros
    ["  30.123.456  ", "30123456"], // espacios alrededor
    [123456, "123456"], // number de Excel, mínimo
    [123456789, "123456789"], // number de Excel, máximo
    ["123456.0", "123456"],
  ])("acepta %s", (v, esperado) => expect(normalizarDni(v)).toEqual({ ok: true, dni: esperado }));

  it.each<string | number>(["12.345", "1.234.567.890", "30123456.5", 30123456.5, "30123456.0.0", "--", "."])(
    "rechaza %s",
    (v) => expect(normalizarDni(v).ok).toBe(false),
  );
  it("sin números da el motivo específico", () => {
    expect(normalizarDni("...")).toEqual({ ok: false, motivo: "El DNI no tiene números" });
  });
  it("puntuación mal puesta da el motivo de formato", () => {
    const r = normalizarDni("30..123");
    expect(!r.ok && r.motivo).toContain("solo con números");
  });
  it("el resultado de normalizar se puede volver a normalizar (idempotente)", () => {
    const r = normalizarDni("30.123.456");
    expect(r.ok && normalizarDni(r.dni)).toEqual({ ok: true, dni: "30123456" });
  });
});

describe("coincideBusqueda: puntos", () => {
  const campos = ["Juan", "Perez", "30123456"] as const;
  it("búsqueda parcial de DNI con punto sigue funcionando", () => {
    expect(coincideBusqueda("30.123", ...campos)).toBe(true);
    expect(coincideBusqueda("30.124", ...campos)).toBe(false);
  });
  it("DNI con puntos más nombre", () => expect(coincideBusqueda("30.123.456 juan", ...campos)).toBe(true));
  it("un punto en medio de una palabra con letras se busca literal", () => {
    expect(coincideBusqueda("j.perez", ...campos)).toBe(false);
    expect(coincideBusqueda("j.perez", "j.perez", null)).toBe(true);
  });
});

describe("otros", () => {
  it("formatearDni", () => expect(formatearDni("30123456")).toBe("30.123.456"));
  it("claveNombre ignora acentos, mayúsculas y espacios", () => {
    expect(claveNombre("José ", "PEÑA")).toBe(claveNombre("jose", "pena"));
  });
});
