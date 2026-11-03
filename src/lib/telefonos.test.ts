import { describe, expect, it } from "vitest";
import { esTelefonoWhatsApp, formatearTelefono, normalizarTelefono } from "./telefonos";

const ok = (telefono: string) => ({ ok: true, telefono });

describe("normalizarTelefono", () => {
  it.each([
    ["+54 9 351 123-4567", "5493511234567"],
    ["5493511234567", "5493511234567"],
    ["543511234567", "5493511234567"], // sin el 9
    ["0054 9 11 2345 6789", "5491123456789"],
    ["0351 15 123 4567", "5493511234567"], // 0 + área + 15
    ["351 15 1234567", "5493511234567"],
    ["11 15 2345 6789", "5491123456789"],
    ["2954 15 123456", "5492954123456"],
    ["(0351) 1234567", "5493511234567"],
    ["351-1234567", "5493511234567"],
    ["1123456789", "5491123456789"],
    [3511234567, "5493511234567"], // número de Excel
  ])("%s -> %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toEqual(ok(esperado));
  });

  it("usa el código de área por defecto cuando falta", () => {
    expect(normalizarTelefono("1234567", "351")).toEqual(ok("5493511234567"));
    expect(normalizarTelefono("15 1234567", "0351")).toEqual(ok("5493511234567"));
    expect(normalizarTelefono("23456789", "11")).toEqual(ok("5491123456789"));
  });

  describe("código de área del gimnasio: 3482 (Reconquista, 6 dígitos locales)", () => {
    it.each([
      ["3482 123456", "5493482123456"],
      ["03482 15 123456", "5493482123456"],
      ["3482 15 123456", "5493482123456"],
      ["+54 9 3482 123456", "5493482123456"],
      ["5493482123456", "5493482123456"],
      ["123456", "5493482123456"], // sin área
      ["15 123456", "5493482123456"], // sin área, con 15
      ["15123456", "5493482123456"],
      ["3482-15-123456", "5493482123456"],
    ])("%s -> %s", (entrada, esperado) => {
      expect(normalizarTelefono(entrada, "3482")).toEqual(ok(esperado));
    });

    it("un número de otra ciudad con su área no se modifica", () => {
      expect(normalizarTelefono("0351 15 1234567", "3482")).toEqual(ok("5493511234567"));
      expect(normalizarTelefono("11 2345 6789", "3482")).toEqual(ok("5491123456789"));
    });

    it("rechaza un número local con dígitos de más para el área 3482", () => {
      expect(normalizarTelefono("1234567", "3482").ok).toBe(false);
    });
  });

  it("sin área por defecto, un número corto es inválido", () => {
    expect(normalizarTelefono("1234567").ok).toBe(false);
  });

  it.each(["", null, undefined, "abc", "123", "5493511234567890"])("rechaza %s", (v) => {
    expect(normalizarTelefono(v).ok).toBe(false);
  });
});

describe("esTelefonoWhatsApp / formatearTelefono", () => {
  it("valida formato guardado", () => {
    expect(esTelefonoWhatsApp("5493511234567")).toBe(true);
    expect(esTelefonoWhatsApp("3511234567")).toBe(false);
    expect(esTelefonoWhatsApp(null)).toBe(false);
  });
  it("formatea para mostrar", () => {
    expect(formatearTelefono("5493511234567")).toBe("+54 9 351 123-4567");
    expect(formatearTelefono("5491123456789")).toBe("+54 9 11 2345-6789");
  });
});
