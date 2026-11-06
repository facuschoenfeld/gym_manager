import { describe, expect, it } from "vitest";
import type { Plan } from "@/features/planes/logica/plan";
import {
  camposRepetidos,
  detectarMapeo,
  fechaDeCelda,
  guardarMapeo,
  leerMapeoGuardado,
  mapeoTieneNombre,
  planificarAcciones,
  REFERENCIA_VENCIMIENTO_IMPORTADO,
  validarArchivo,
  validarFila,
  type ContextoImportacion,
  type FilaImportacion,
  type MapeoColumnas,
} from "./importar";

const planes: Plan[] = [
  { id: 1, nombre: "Mensual", periodo: "mes", cantidad: 1, monto: 1500000, activo: true },
  { id: 2, nombre: "Semanal", periodo: "semana", cantidad: 1, monto: 500000, activo: true },
];

const ctx: ContextoImportacion = { planes, codigoArea: "3482", hoy: "2026-11-06" };

const mapeo: MapeoColumnas = ["nombre", "apellido", "dni", "telefono", "plan", "ultimoPago", "vencimiento", "monto"];

function fila(numero: number, celdas: unknown[]): FilaImportacion {
  return { numero, celdas };
}

describe("detectarMapeo", () => {
  it("reconoce encabezados con tildes, mayúsculas y signos", () => {
    const m = detectarMapeo(["NOMBRE", "Apellido", "D.N.I.", "Teléfono celular", "Mail", "Plan", "Último pago", "Vence", "Precio"]);
    expect(m).toEqual(["nombre", "apellido", "dni", "telefono", "email", "plan", "ultimoPago", "vencimiento", "monto"]);
  });

  it("columnas desconocidas quedan ignoradas y un campo se asigna una sola vez", () => {
    const m = detectarMapeo(["Nombre", "Nombre completo", "Comentarios", "Telefono"]);
    expect(m).toEqual(["nombre", null, null, "telefono"]);
  });

  it('"Pago" a secas no se toma como último pago', () => {
    expect(detectarMapeo(["Nombre", "Pago"])).toEqual(["nombre", null]);
  });

  it("sin columna de nombre no se puede importar", () => {
    expect(mapeoTieneNombre(detectarMapeo(["Apellido", "DNI"]))).toBe(false);
    expect(mapeoTieneNombre(detectarMapeo(["Nombre"]))).toBe(true);
  });
});

describe("leerMapeoGuardado", () => {
  it("devuelve el mapeo guardado si los encabezados son los mismos (sin importar tildes ni mayúsculas)", () => {
    const texto = guardarMapeo(["Nombre", "Teléfono"], ["nombre", "telefono"]);
    expect(leerMapeoGuardado(texto, ["NOMBRE", "Telefono"])).toEqual(["nombre", "telefono"]);
  });

  it("no lo usa si cambian los encabezados, aunque tengan la misma cantidad de columnas", () => {
    const texto = guardarMapeo(["Nombre", "DNI"], ["nombre", "dni"]);
    expect(leerMapeoGuardado(texto, ["Nombre", "Celular"])).toBeNull();
    expect(leerMapeoGuardado(texto, ["Nombre"])).toBeNull();
  });

  it("descarta texto que no es JSON o no tiene la forma esperada, y campos inventados", () => {
    expect(leerMapeoGuardado("no es json", ["Nombre"])).toBeNull();
    expect(leerMapeoGuardado("", ["Nombre"])).toBeNull();
    expect(leerMapeoGuardado('["nombre"]', ["Nombre"])).toBeNull();
    const texto = JSON.stringify({ encabezados: ["nombre", "x"], mapeo: ["nombre", "inventado"] });
    expect(leerMapeoGuardado(texto, ["Nombre", "X"])).toEqual(["nombre", null]);
  });
});

describe("fechaDeCelda", () => {
  it("número de serie de Excel (solo si la celda es numérica)", () => {
    expect(fechaDeCelda(46000)).toBe("2025-12-09");
  });
  it("texto dd/mm/aaaa y ISO", () => {
    expect(fechaDeCelda("05/10/2026")).toBe("2026-10-05");
    expect(fechaDeCelda("2026-10-05")).toBe("2026-10-05");
  });
  it("vacío es null; lo imposible o no entendible es 'invalida'", () => {
    expect(fechaDeCelda("")).toBeNull();
    expect(fechaDeCelda(null)).toBeNull();
    expect(fechaDeCelda("31/02/2026")).toBe("invalida");
    expect(fechaDeCelda("ayer")).toBe("invalida");
    // Un texto con solo dígitos ("2026") no es un número de serie.
    expect(fechaDeCelda("2026")).toBe("invalida");
  });
});

describe("validarFila", () => {
  it("una fila completa queda lista con sus datos normalizados", () => {
    const r = validarFila(
      fila(2, ["  juan ", "PÉREZ", "30.123.456", "351 15 123 4567", "Mensual", "05/10/2026", "", "15000"]),
      mapeo,
      ctx,
    );
    expect(r.errores).toEqual([]);
    expect(r.socio).toEqual({
      nombre: "Juan",
      apellido: "Pérez",
      dni: "30123456",
      telefono: "5493511234567",
      email: null,
      planId: 1,
      pago: { fechaPago: "2026-10-05", venceEl: "2026-11-05", monto: 1500000, referencia: null },
    });
  });

  it("falta el nombre o el DNI está mal: la fila tiene error y no hay socio", () => {
    const sinNombre = validarFila(fila(3, ["", "", "30123456"]), mapeo, ctx);
    expect(sinNombre.errores).toContain("Falta el nombre");
    expect(sinNombre.socio).toBeNull();

    const dniMal = validarFila(fila(4, ["Ana", "", "3.0.1"]), mapeo, ctx);
    expect(dniMal.errores.some((e) => e.startsWith("DNI:"))).toBe(true);
    expect(dniMal.socio).toBeNull();
  });

  it("teléfono inválido es error; email inválido solo avisa", () => {
    const r = validarFila(fila(5, ["Ana", "", "30123456", "12", "", "", "", ""]), mapeo, ctx);
    expect(r.errores.some((e) => e.startsWith("Teléfono:"))).toBe(true);

    const m: MapeoColumnas = ["nombre", "email"];
    const e = validarFila(fila(6, ["Ana", "ana-sin-arroba"]), m, ctx);
    expect(e.errores).toEqual([]);
    expect(e.avisos[0]).toContain("no es válido");
    expect(e.socio?.email).toBeNull();
  });

  it("plan que no existe: aviso y se importa sin plan", () => {
    const r = validarFila(fila(7, ["Ana", "", "30123456", "", "Anual"]), mapeo, ctx);
    expect(r.socio?.planId).toBeNull();
    expect(r.avisos.some((a) => a.includes("no existe"))).toBe(true);
  });

  it("último pago sin plan ni vencimiento es error", () => {
    const m: MapeoColumnas = ["nombre", "dni", "ultimoPago"];
    const r = validarFila(fila(8, ["Ana", "30123456", "05/10/2026"]), m, ctx);
    expect(r.errores).toContain("El último pago necesita un plan o una fecha de vencimiento");
  });

  it("último pago con plan calcula el vencimiento, y sin columna Monto el pago queda en 0 con aviso", () => {
    const m: MapeoColumnas = ["nombre", "plan", "ultimoPago"];
    const r = validarFila(fila(9, ["Ana", "Semanal", "01/11/2026"]), m, ctx);
    expect(r.socio?.pago).toEqual({ fechaPago: "2026-11-01", venceEl: "2026-11-08", monto: 0, referencia: null });
    expect(r.avisos.some((a) => a.includes("No hay monto"))).toBe(true);
  });

  it("vencimiento sin último pago: registro sin cobro (monto 0 y referencia), fecha no futura, con aviso", () => {
    const m: MapeoColumnas = ["nombre", "vencimiento"];
    const r = validarFila(fila(10, ["Ana", "20/12/2026"]), m, ctx);
    expect(r.socio?.pago).toEqual({
      fechaPago: "2026-11-06",
      venceEl: "2026-12-20",
      monto: 0,
      referencia: REFERENCIA_VENCIMIENTO_IMPORTADO,
    });
    expect(r.avisos.some((a) => a.includes("No hay fecha de último pago"))).toBe(true);
  });

  it("fecha imposible es error", () => {
    const m: MapeoColumnas = ["nombre", "ultimoPago"];
    const r = validarFila(fila(11, ["Ana", "31/02/2026"]), m, ctx);
    expect(r.errores.some((e) => e.startsWith("Último pago:"))).toBe(true);
  });

  it("fecha fuera de rango (antes de 2000 o más de un año adelante) es error", () => {
    const m: MapeoColumnas = ["nombre", "ultimoPago"];
    // 1000 como número de serie de Excel cae en 1902.
    expect(validarFila(fila(12, ["Ana", 1000]), m, ctx).errores.some((e) => e.includes("fuera de rango"))).toBe(true);
    expect(validarFila(fila(13, ["Ana", "01/01/2028"]), m, ctx).errores.some((e) => e.includes("fuera de rango"))).toBe(true);
  });

  it("vencimiento anterior al último pago es error", () => {
    const m: MapeoColumnas = ["nombre", "ultimoPago", "vencimiento"];
    const r = validarFila(fila(14, ["Ana", "01/10/2026", "01/09/2026"]), m, ctx);
    expect(r.errores).toContain("El vencimiento es anterior a la fecha del último pago");
  });
});

describe("validarArchivo", () => {
  it("un DNI repetido deja la segunda fila con error", () => {
    const filas = [fila(2, ["Ana", "", "30123456"]), fila(3, ["Ana B", "", "30.123.456"])];
    const r = validarArchivo(filas, mapeo, ctx);
    expect(r[0]?.socio).not.toBeNull();
    expect(r[1]?.socio).toBeNull();
    expect(r[1]?.errores[0]).toContain("fila 2");
  });

  it("nombre repetido sin DNI solo avisa", () => {
    const m: MapeoColumnas = ["nombre", "apellido"];
    const filas = [fila(2, ["Ana", "Gómez"]), fila(3, ["ana", "gomez"])];
    const r = validarArchivo(filas, m, ctx);
    expect(r[1]?.socio).not.toBeNull();
    expect(r[1]?.avisos[0]).toContain("Posible duplicado");
  });
});

describe("planificarAcciones", () => {
  const existentes = [{ id: 7, dni: "30123456", nombre: "Ana", apellido: null, activo: true }];

  it("un DNI existente se actualiza; uno nuevo se crea", () => {
    const validas = validarArchivo([fila(2, ["Ana", "", "30123456"]), fila(3, ["Luis", "", "28111222"])], mapeo, ctx);
    const { acciones, conflictos } = planificarAcciones(validas, existentes);
    expect(conflictos).toEqual([]);
    expect(acciones.map((a) => [a.tipo, a.numero])).toEqual([
      ["actualizar", 2],
      ["crear", 3],
    ]);
    const primera = acciones[0];
    expect(primera?.tipo === "actualizar" && primera.clienteId).toBe(7);
  });

  it("sin DNI se busca por nombre y apellido", () => {
    const m: MapeoColumnas = ["nombre", "apellido"];
    const validas = validarArchivo([fila(2, ["ana", ""])], m, ctx);
    const { acciones } = planificarAcciones(validas, existentes);
    expect(acciones[0]?.tipo).toBe("actualizar");
  });

  it("dos filas que caen en el mismo socio existente: la segunda queda como conflicto", () => {
    const validas = validarArchivo([fila(2, ["Ana", "", "30123456"]), fila(3, ["Ana", "", ""])], mapeo, ctx);
    const { acciones, conflictos } = planificarAcciones(validas, existentes);
    expect(acciones.map((a) => a.numero)).toEqual([2]);
    expect(conflictos).toEqual([{ numero: 3, motivo: "Coincide con el mismo socio que la fila 2" }]);
  });

  it("nombre que coincide con varios socios sin DNI: conflicto para elegir a mano", () => {
    const dosLuis = [
      { id: 1, dni: null, nombre: "Luis", apellido: "Gómez", activo: true },
      { id: 2, dni: null, nombre: "Luis", apellido: "Gómez", activo: true },
    ];
    const m: MapeoColumnas = ["nombre", "apellido"];
    const validas = validarArchivo([fila(2, ["Luis", "Gómez"])], m, ctx);
    const { acciones, conflictos } = planificarAcciones(validas, dosLuis);
    expect(acciones).toEqual([]);
    expect(conflictos[0]?.motivo).toContain("2 socios");
  });
});

describe("socios dados de baja", () => {
  it("se actualizan con los datos del archivo pero se marcan como dados de baja", () => {
    const bajas = [{ id: 9, dni: "30123456", nombre: "Ana", apellido: null, activo: false }];
    const validas = validarArchivo([fila(2, ["Ana", "", "30123456"])], mapeo, ctx);
    const { acciones } = planificarAcciones(validas, bajas);
    expect(acciones[0]).toMatchObject({ tipo: "actualizar", clienteId: 9, dadoDeBaja: true });
  });
});

describe("camposRepetidos", () => {
  it("detecta un campo asignado a dos columnas y lo devuelve una sola vez", () => {
    expect(camposRepetidos(["dni", null, "dni", "nombre", "nombre"])).toEqual(["dni", "nombre"]);
  });
  it("sin repetidos devuelve lista vacía", () => {
    expect(camposRepetidos(["nombre", null, "dni"])).toEqual([]);
  });
});
