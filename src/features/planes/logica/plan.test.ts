import { describe, expect, it } from "vitest";
import { esquemaPlan, nombreDePlanRepetido, planesElegibles, PRECIO_MAXIMO_CENTAVOS, type Plan } from "./plan";

const valido = { nombre: "Mensual", periodo: "mes", cantidad: "1", monto: "25000" };

function plan(id: number, nombre: string, activo = true): Plan {
  return { id, nombre, periodo: "mes", cantidad: 1, monto: 0, activo };
}

describe("esquemaPlan: tope de precio", () => {
  const base = { nombre: "Mensual", periodo: "mes" as const, cantidad: "1" };
  it("acepta el precio máximo ($ 100.000.000)", () => {
    const r = esquemaPlan.safeParse({ ...base, monto: "100.000.000" });
    expect(r.success && r.data.monto).toBe(PRECIO_MAXIMO_CENTAVOS);
  });
  it.each(["100.000.000,01", "99999999999999999999"])("rechaza un precio por encima del máximo: %s", (monto) => {
    expect(esquemaPlan.safeParse({ ...base, monto }).success).toBe(false);
  });
});

describe("esquemaPlan", () => {
  it("acepta un plan válido y convierte cantidad y monto", () => {
    const r = esquemaPlan.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ nombre: "Mensual", periodo: "mes", cantidad: 1, monto: 2500000 });
    }
  });

  it("recorta el nombre", () => {
    const r = esquemaPlan.safeParse({ ...valido, nombre: "  Semanal  " });
    expect(r.success && r.data.nombre).toBe("Semanal");
  });

  it("rechaza nombre vacío o solo espacios", () => {
    expect(esquemaPlan.safeParse({ ...valido, nombre: "" }).success).toBe(false);
    expect(esquemaPlan.safeParse({ ...valido, nombre: "   " }).success).toBe(false);
  });

  it("rechaza nombre de más de 60 caracteres y acepta justo 60", () => {
    expect(esquemaPlan.safeParse({ ...valido, nombre: "a".repeat(61) }).success).toBe(false);
    expect(esquemaPlan.safeParse({ ...valido, nombre: "a".repeat(60) }).success).toBe(true);
  });

  it("rechaza período inválido", () => {
    expect(esquemaPlan.safeParse({ ...valido, periodo: "año" }).success).toBe(false);
  });

  it.each(["abc", "", "1.5", "-2", "1,5"])("rechaza cantidad no numérica entera: %j", (cantidad) => {
    expect(esquemaPlan.safeParse({ ...valido, cantidad }).success).toBe(false);
  });

  it("rechaza cantidad 0 y 37; acepta 1 y 36", () => {
    expect(esquemaPlan.safeParse({ ...valido, cantidad: "0" }).success).toBe(false);
    expect(esquemaPlan.safeParse({ ...valido, cantidad: "37" }).success).toBe(false);
    expect(esquemaPlan.safeParse({ ...valido, cantidad: "1" }).success).toBe(true);
    expect(esquemaPlan.safeParse({ ...valido, cantidad: "36" }).success).toBe(true);
  });

  it.each([
    ["25.000", 2500000],
    ["25000,50", 2500050],
    ["0", 0],
    ["$ 25.000,50", 2500050],
  ])("interpreta el monto %j como %i centavos", (monto, centavos) => {
    const r = esquemaPlan.safeParse({ ...valido, monto });
    expect(r.success && r.data.monto).toBe(centavos);
  });

  it.each(["abc", "", "   ", "-100"])("rechaza el monto %j", (monto) => {
    expect(esquemaPlan.safeParse({ ...valido, monto }).success).toBe(false);
  });

  it("el monto resultante es un entero", () => {
    const r = esquemaPlan.safeParse({ ...valido, monto: "19999,99" });
    expect(r.success && Number.isInteger(r.data.monto)).toBe(true);
  });
});

describe("nombreDePlanRepetido", () => {
  const planes = [plan(1, "Mensual"), plan(2, "Pase Diario")];

  it("detecta repetidos ignorando mayúsculas, acentos y espacios", () => {
    expect(nombreDePlanRepetido("  mensual ", planes)).toBe(true);
    expect(nombreDePlanRepetido("PASE DIARIO", planes)).toBe(true);
    expect(nombreDePlanRepetido("Pásé Diário", planes)).toBe(true);
  });

  it("no marca nombres distintos", () => {
    expect(nombreDePlanRepetido("Semanal", planes)).toBe(false);
  });

  it("excluye el plan que se está editando", () => {
    expect(nombreDePlanRepetido("Mensual", planes, 1)).toBe(false);
    expect(nombreDePlanRepetido("Mensual", planes, 2)).toBe(true);
  });

  it("incluye planes inactivos en la comparación", () => {
    expect(nombreDePlanRepetido("Trimestral", [plan(3, "Trimestral", false)])).toBe(true);
  });

  it("con lista vacía no hay repetidos", () => {
    expect(nombreDePlanRepetido("Mensual", [])).toBe(false);
  });
});

describe("planesElegibles", () => {
  const planes = [plan(1, "A"), plan(2, "B", false), plan(3, "C", false)];

  it("solo devuelve los activos si el socio no tiene plan", () => {
    expect(planesElegibles(planes, null).map((p) => p.id)).toEqual([1]);
  });

  it("incluye el plan actual del socio aunque esté inactivo", () => {
    expect(planesElegibles(planes, 2).map((p) => p.id)).toEqual([1, 2]);
  });

  it("si el plan actual está activo no duplica nada", () => {
    expect(planesElegibles(planes, 1).map((p) => p.id)).toEqual([1]);
  });

  it("ignora un plan actual inexistente", () => {
    expect(planesElegibles(planes, 99).map((p) => p.id)).toEqual([1]);
  });
});
