import { describe, expect, it } from "vitest";
import { debeActualizar, saludoSegunHora, textoSaludo } from "./saludo";

// Fecha local fija: 2 de noviembre de 2026, a la hora indicada.
const a = (h: number, m = 0) => new Date(2026, 10, 2, h, m);

describe("saludoSegunHora", () => {
  it("de 0:00 a 5:59 y de 20:00 en adelante es 'Buenas noches'", () => {
    expect(saludoSegunHora(a(0))).toBe("Buenas noches");
    expect(saludoSegunHora(a(5, 59))).toBe("Buenas noches");
    expect(saludoSegunHora(a(20))).toBe("Buenas noches");
    expect(saludoSegunHora(a(23, 59))).toBe("Buenas noches");
  });

  it("de 6:00 a 12:59 es 'Buen día'", () => {
    expect(saludoSegunHora(a(6))).toBe("Buen día");
    expect(saludoSegunHora(a(12))).toBe("Buen día");
    expect(saludoSegunHora(a(12, 59))).toBe("Buen día");
  });

  it("de 13:00 a 19:59 es 'Buenas tardes'", () => {
    expect(saludoSegunHora(a(13))).toBe("Buenas tardes");
    expect(saludoSegunHora(a(19, 59))).toBe("Buenas tardes");
  });

  it("límites exactos entre franjas: 5:59/6:00, 12:59/13:00 y 19:59/20:00", () => {
    expect(saludoSegunHora(a(5, 59))).toBe("Buenas noches");
    expect(saludoSegunHora(a(6, 0))).toBe("Buen día");
    expect(saludoSegunHora(a(12, 59))).toBe("Buen día");
    expect(saludoSegunHora(a(13, 0))).toBe("Buenas tardes");
    expect(saludoSegunHora(a(19, 59))).toBe("Buenas tardes");
    expect(saludoSegunHora(a(20, 0))).toBe("Buenas noches");
  });

  it("sin argumento usa la hora actual (no lanza y devuelve un saludo válido)", () => {
    expect(["Buen día", "Buenas tardes", "Buenas noches"]).toContain(saludoSegunHora());
  });

  it("no tiene huecos: cada hora del día cae en una franja", () => {
    for (let h = 0; h < 24; h++) {
      expect(["Buen día", "Buenas tardes", "Buenas noches"]).toContain(saludoSegunHora(a(h)));
    }
  });
});

describe("textoSaludo", () => {
  it("combina el saludo con la fecha de hoy en formato dd/mm/yyyy", () => {
    expect(textoSaludo(a(9))).toBe("Buen día, hoy es 02/11/2026");
  });

  it("usa ceros a la izquierda en día y mes", () => {
    expect(textoSaludo(new Date(2026, 0, 5, 14))).toBe("Buenas tardes, hoy es 05/01/2026");
  });

  it("cambia de fecha a medianoche (hora local, sin correrse por UTC)", () => {
    expect(textoSaludo(new Date(2026, 10, 30, 23, 59))).toBe("Buenas noches, hoy es 30/11/2026");
    expect(textoSaludo(new Date(2026, 11, 1, 0, 0))).toBe("Buenas noches, hoy es 01/12/2026");
  });

  it("22:30 hora local mantiene el día local (no pasa al día siguiente por UTC)", () => {
    expect(textoSaludo(new Date(2026, 10, 2, 22, 30))).toBe("Buenas noches, hoy es 02/11/2026");
  });

  it("maneja un 29/02 en año bisiesto", () => {
    expect(textoSaludo(new Date(2028, 1, 29, 10))).toBe("Buen día, hoy es 29/02/2028");
  });
});

describe("debeActualizar", () => {
  it("no actualiza si solo cambian los minutos dentro de la misma franja y día", () => {
    expect(debeActualizar(new Date(2026, 10, 2, 9, 10), new Date(2026, 10, 2, 9, 11))).toBe(false);
  });

  it("actualiza al cruzar a otra franja horaria", () => {
    expect(debeActualizar(new Date(2026, 10, 2, 12, 59), new Date(2026, 10, 2, 13, 0))).toBe(true);
    expect(debeActualizar(new Date(2026, 10, 2, 19, 59), new Date(2026, 10, 2, 20, 0))).toBe(true);
    expect(debeActualizar(new Date(2026, 10, 3, 5, 59), new Date(2026, 10, 3, 6, 0))).toBe(true);
  });

  it("no actualiza con el mismo instante ni cruzando segundos dentro de la misma franja", () => {
    const t = new Date(2026, 10, 2, 9, 0, 0);
    expect(debeActualizar(t, new Date(t))).toBe(false);
    expect(debeActualizar(new Date(2026, 10, 2, 13, 0, 0), new Date(2026, 10, 2, 19, 59, 59))).toBe(false);
  });

  it("actualiza al mismo horario de otro día (misma franja, distinta fecha)", () => {
    expect(debeActualizar(new Date(2026, 10, 2, 9, 0), new Date(2026, 10, 3, 9, 0))).toBe(true);
  });

  it("actualiza al cambiar de día aunque la franja sea la misma (medianoche)", () => {
    expect(debeActualizar(new Date(2026, 10, 2, 23, 59), new Date(2026, 10, 3, 0, 0))).toBe(true);
  });
});
