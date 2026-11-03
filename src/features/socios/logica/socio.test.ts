import { describe, expect, it } from "vitest";
import {
  agregarEstado,
  buscarDuplicados,
  contarParaFiltros,
  contarPorEstado,
  crearEsquemaSocio,
  FILTROS_INICIALES,
  filtrarSocios,
  leerFiltrosGuardados,
  nombreCompleto,
  socioAFormulario,
  type FormularioSocio,
  type Socio,
  type SocioConEstado,
} from "./socio";

function socio(parcial: Partial<Socio> = {}): Socio {
  return {
    id: 1,
    nombre: "Juan",
    apellido: "Pérez",
    dni: null,
    email: null,
    telefono: null,
    planId: 1,
    planNombre: "Mensual",
    planMonto: 2500000,
    fechaAlta: "2026-01-01",
    activo: true,
    notas: null,
    venceEl: null,
    ultimoAviso: null,
    ...parcial,
  };
}

function conEstado(parcial: Partial<SocioConEstado> = {}): SocioConEstado {
  return { ...socio(), estado: "pago", diasParaVencer: 10, ...parcial };
}

const formularioValido: FormularioSocio = {
  nombre: "juan",
  apellido: "pérez",
  dni: "",
  telefono: "",
  email: "",
  planId: "1",
  notas: "",
};

describe("crearEsquemaSocio", () => {
  const esquema = crearEsquemaSocio("3482");

  it("caso feliz mínimo: capitaliza y deja opcionales en null", () => {
    const r = esquema.safeParse(formularioValido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        nombre: "Juan",
        apellido: "Pérez",
        dni: null,
        telefono: null,
        email: null,
        planId: 1,
        notas: null,
      });
    }
  });

  it("capitaliza nombre y apellido con espacios y partículas", () => {
    const r = esquema.safeParse({ ...formularioValido, nombre: "  mARÍA   josé ", apellido: "DE LA cruz" });
    expect(r.success && r.data.nombre).toBe("María José");
    expect(r.success && r.data.apellido).toBe("De la Cruz");
  });

  it("nombre y apellido son obligatorios", () => {
    expect(esquema.safeParse({ ...formularioValido, nombre: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...formularioValido, nombre: "   " }).success).toBe(false);
    expect(esquema.safeParse({ ...formularioValido, apellido: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...formularioValido, apellido: "  " }).success).toBe(false);
  });

  it("DNI con puntos se guarda sin puntos", () => {
    const r = esquema.safeParse({ ...formularioValido, dni: "12.345.678" });
    expect(r.success && r.data.dni).toBe("12345678");
  });

  it("DNI vacío o con espacios es null", () => {
    const r = esquema.safeParse({ ...formularioValido, dni: "   " });
    expect(r.success && r.data.dni).toBeNull();
  });

  it.each(["123", "1234567890", "abc"])("DNI inválido %j da error", (dni) => {
    const r = esquema.safeParse({ ...formularioValido, dni });
    expect(r.success).toBe(false);
  });

  it("teléfono vacío es null", () => {
    const r = esquema.safeParse({ ...formularioValido, telefono: "  " });
    expect(r.success && r.data.telefono).toBeNull();
  });

  it('teléfono "15 123456" se completa con el código de área', () => {
    const r = esquema.safeParse({ ...formularioValido, telefono: "15 123456" });
    expect(r.success && r.data.telefono).toBe("5493482123456");
  });

  it("teléfono completo con código de área", () => {
    const r = esquema.safeParse({ ...formularioValido, telefono: "3482 15 123456" });
    expect(r.success && r.data.telefono).toBe("5493482123456");
  });

  it("teléfono inválido da error en el campo telefono", () => {
    const r = esquema.safeParse({ ...formularioValido, telefono: "12" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["telefono"]);
  });

  it("email vacío es null; válido se conserva; inválido da error", () => {
    const vacio = esquema.safeParse({ ...formularioValido, email: "  " });
    expect(vacio.success && vacio.data.email).toBeNull();
    const ok = esquema.safeParse({ ...formularioValido, email: " a@b.com " });
    expect(ok.success && ok.data.email).toBe("a@b.com");
    const mal = esquema.safeParse({ ...formularioValido, email: "no-es-email" });
    expect(mal.success).toBe(false);
  });

  it('planId "" da error y "3" se convierte en 3', () => {
    expect(esquema.safeParse({ ...formularioValido, planId: "" }).success).toBe(false);
    expect(esquema.safeParse({ ...formularioValido, planId: "abc" }).success).toBe(false);
    const r = esquema.safeParse({ ...formularioValido, planId: "3" });
    expect(r.success && r.data.planId).toBe(3);
  });

  it("notas se recortan y las vacías son null", () => {
    const a = esquema.safeParse({ ...formularioValido, notas: "  lesión en   rodilla  " });
    expect(a.success && a.data.notas).toBe("lesión en rodilla");
    const b = esquema.safeParse({ ...formularioValido, notas: "   " });
    expect(b.success && b.data.notas).toBeNull();
  });

  it("sin código de área, un teléfono local corto es inválido", () => {
    const r = crearEsquemaSocio("").safeParse({ ...formularioValido, telefono: "15 123456" });
    expect(r.success).toBe(false);
  });
});

describe("socioAFormulario", () => {
  it("convierte nulls en textos vacíos y el plan en texto", () => {
    expect(socioAFormulario(socio({ apellido: null, planId: null }))).toEqual({
      nombre: "Juan",
      apellido: "",
      dni: "",
      telefono: "",
      email: "",
      planId: "",
      notas: "",
    });
  });

  it("ida y vuelta: el formulario de un socio guardado pasa el esquema y da los mismos datos", () => {
    const original = socio({
      dni: "12345678",
      telefono: "5493482123456",
      email: "juan@correo.com",
      planId: 3,
      notas: "nota",
    });
    const r = crearEsquemaSocio("3482").safeParse(socioAFormulario(original));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        nombre: "Juan",
        apellido: "Pérez",
        dni: "12345678",
        telefono: "5493482123456",
        email: "juan@correo.com",
        planId: 3,
        notas: "nota",
      });
    }
  });
});

describe("buscarDuplicados", () => {
  const socios = [
    socio({ id: 1, nombre: "Juan", apellido: "Pérez", dni: "11111111" }),
    socio({ id: 2, nombre: "Ana", apellido: "Gómez", dni: "22222222" }),
    socio({ id: 3, nombre: "Luis", apellido: "Díaz", dni: null }),
  ];

  it("detecta el mismo DNI", () => {
    const r = buscarDuplicados({ nombre: "Otro", apellido: "Nombre", dni: "22222222" }, socios);
    expect(r.mismoDni?.id).toBe(2);
    expect(r.mismoNombre).toEqual([]);
  });

  it("detecta el mismo nombre ignorando acentos y mayúsculas", () => {
    const r = buscarDuplicados({ nombre: "JUAN", apellido: "perez", dni: null }, socios);
    expect(r.mismoDni).toBeNull();
    expect(r.mismoNombre.map((s) => s.id)).toEqual([1]);
  });

  it("excluye al socio que se está editando", () => {
    const r = buscarDuplicados({ nombre: "Juan", apellido: "Pérez", dni: "11111111" }, socios, 1);
    expect(r.mismoDni).toBeNull();
    expect(r.mismoNombre).toEqual([]);
  });

  it("no repite en mismoNombre al que ya es mismoDni", () => {
    const r = buscarDuplicados({ nombre: "Juan", apellido: "Pérez", dni: "11111111" }, socios);
    expect(r.mismoDni?.id).toBe(1);
    expect(r.mismoNombre).toEqual([]);
  });

  it("DNI null no coincide con socios sin DNI", () => {
    const r = buscarDuplicados({ nombre: "Nuevo", apellido: "Socio", dni: null }, socios);
    expect(r.mismoDni).toBeNull();
  });

  it("con mismo nombre y distinto DNI informa solo mismoNombre", () => {
    const r = buscarDuplicados({ nombre: "Ana", apellido: "Gómez", dni: "33333333" }, socios);
    expect(r.mismoDni).toBeNull();
    expect(r.mismoNombre.map((s) => s.id)).toEqual([2]);
  });

  it("sin socios no hay duplicados", () => {
    expect(buscarDuplicados({ nombre: "A", apellido: "B", dni: "1" }, [])).toEqual({ mismoDni: null, mismoNombre: [] });
  });
});

describe("filtrarSocios", () => {
  const lista = [
    conEstado({ id: 1, nombre: "Juan", apellido: "Pérez", dni: "11111111", estado: "pago", venceEl: "2026-12-01" }),
    conEstado({ id: 2, nombre: "Ana", apellido: "Álvarez", dni: "22222222", estado: "vencido", venceEl: "2026-10-01", planId: 2 }),
    conEstado({ id: 3, nombre: "Luis", apellido: "Zárate", estado: "por_vencer", venceEl: "2026-11-05" }),
    conEstado({ id: 4, nombre: "Eva", apellido: "Gil", estado: "sin_pagos", venceEl: null, diasParaVencer: null }),
    conEstado({ id: 5, nombre: "Baja", apellido: "Inactiva", activo: false, estado: "pago", venceEl: "2026-11-20" }),
  ];
  const ids = (r: SocioConEstado[]) => r.map((s) => s.id);

  it("por defecto muestra solo activos", () => {
    expect(ids(filtrarSocios(lista, FILTROS_INICIALES))).not.toContain(5);
    expect(filtrarSocios(lista, FILTROS_INICIALES)).toHaveLength(4);
  });

  it("filtro inactivos y todos", () => {
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, activo: "inactivos" }))).toEqual([5]);
    expect(filtrarSocios(lista, { ...FILTROS_INICIALES, activo: "todos" })).toHaveLength(5);
  });

  it("filtra por estado", () => {
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, estado: "vencido" }))).toEqual([2]);
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, estado: "sin_pagos" }))).toEqual([4]);
  });

  it("filtra por plan", () => {
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, planId: 2 }))).toEqual([2]);
  });

  it("busca por nombre, apellido sin acentos y DNI con puntos", () => {
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, busqueda: "ana" }))).toEqual([2]);
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, busqueda: "perez" }))).toEqual([1]);
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, busqueda: "alvarez" }))).toEqual([2]);
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, busqueda: "11.111.111" }))).toEqual([1]);
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, busqueda: "juan perez" }))).toEqual([1]);
    expect(filtrarSocios(lista, { ...FILTROS_INICIALES, busqueda: "inexistente" })).toEqual([]);
  });

  it("ordena por apellido y nombre con acentos en es-AR (Á junto a A)", () => {
    // Álvarez, Gil, Pérez, Zárate
    expect(ids(filtrarSocios(lista, FILTROS_INICIALES))).toEqual([2, 4, 1, 3]);
  });

  it("ordena por nombre cuando el apellido es igual o falta", () => {
    const l = [
      conEstado({ id: 1, nombre: "Zoe", apellido: "Ruiz" }),
      conEstado({ id: 2, nombre: "Ana", apellido: "Ruiz" }),
      conEstado({ id: 3, nombre: "Beto", apellido: null }),
    ];
    expect(ids(filtrarSocios(l, FILTROS_INICIALES))).toEqual([3, 2, 1]);
  });

  it("ordena por vencimiento con los sin pagos al final", () => {
    expect(ids(filtrarSocios(lista, { ...FILTROS_INICIALES, orden: "vencimiento" }))).toEqual([2, 3, 1, 4]);
  });

  it("varios sin pagos en orden por vencimiento se desempatan por nombre", () => {
    const l = [
      conEstado({ id: 1, nombre: "Zoe", apellido: "Ruiz", venceEl: null }),
      conEstado({ id: 2, nombre: "Ana", apellido: "Ruiz", venceEl: null }),
      conEstado({ id: 3, nombre: "X", apellido: "Y", venceEl: "2026-01-01" }),
    ];
    expect(ids(filtrarSocios(l, { ...FILTROS_INICIALES, orden: "vencimiento" }))).toEqual([3, 2, 1]);
  });

  it("no modifica el arreglo original", () => {
    const copia = [...lista];
    filtrarSocios(lista, { ...FILTROS_INICIALES, orden: "vencimiento" });
    expect(lista).toEqual(copia);
  });

  it("combina filtros", () => {
    const r = filtrarSocios(lista, { ...FILTROS_INICIALES, activo: "todos", estado: "pago", busqueda: "baja" });
    expect(ids(r)).toEqual([5]);
  });
});

describe("contarPorEstado", () => {
  it("cuenta todos los socios que recibe (el filtrado lo hace quien llama)", () => {
    const l = [
      conEstado({ estado: "pago" }),
      conEstado({ estado: "pago", activo: false }),
      conEstado({ estado: "vencido" }),
      conEstado({ estado: "vencido" }),
      conEstado({ estado: "por_vencer", activo: false }),
      conEstado({ estado: "sin_pagos" }),
    ];
    expect(contarPorEstado(l)).toEqual({ pago: 2, por_vencer: 1, vencido: 2, sin_pagos: 1 });
  });
});

describe("contarParaFiltros", () => {
  const l = [
    conEstado({ id: 1, estado: "pago", planId: 1 }),
    conEstado({ id: 2, estado: "pago", activo: false, planId: 1 }),
    conEstado({ id: 3, estado: "vencido", planId: 2 }),
    conEstado({ id: 4, estado: "por_vencer", activo: false, planId: 2 }),
  ];
  it("con 'activos' cuenta solo activos", () => {
    expect(contarParaFiltros(l, FILTROS_INICIALES)).toEqual({ pago: 1, por_vencer: 0, vencido: 1, sin_pagos: 0 });
  });
  it("con 'dados de baja' cuenta solo los inactivos", () => {
    expect(contarParaFiltros(l, { ...FILTROS_INICIALES, activo: "inactivos" })).toEqual({
      pago: 1,
      por_vencer: 1,
      vencido: 0,
      sin_pagos: 0,
    });
  });
  it("respeta el filtro de plan pero ignora el de estado", () => {
    expect(contarParaFiltros(l, { ...FILTROS_INICIALES, activo: "todos", planId: 2, estado: "pago" })).toEqual({
      pago: 0,
      por_vencer: 1,
      vencido: 1,
      sin_pagos: 0,
    });
  });
});

describe("leerFiltrosGuardados", () => {
  it("sin nada guardado devuelve los filtros iniciales", () => {
    expect(leerFiltrosGuardados(null)).toEqual(FILTROS_INICIALES);
  });
  it("combina lo guardado con los valores iniciales", () => {
    expect(leerFiltrosGuardados(JSON.stringify({ estado: "vencido", planId: 3 }))).toEqual({
      ...FILTROS_INICIALES,
      estado: "vencido",
      planId: 3,
    });
  });
  it.each(["{no es json", JSON.stringify({ estado: "x" }), JSON.stringify({ planId: -1 }), JSON.stringify([1, 2])])(
    "descarta lo inválido o corrupto: %s",
    (json) => {
      expect(leerFiltrosGuardados(json)).toEqual(FILTROS_INICIALES);
    },
  );

  it("lista vacía da todo en cero", () => {
    expect(contarPorEstado([])).toEqual({ pago: 0, por_vencer: 0, vencido: 0, sin_pagos: 0 });
  });
});

describe("agregarEstado", () => {
  const params = { diasPorVencer: 5, diasGracia: 2 };
  const hoy = "2026-11-03";

  it("calcula estado y días para vencer con calcularEstado", () => {
    const r = agregarEstado(
      [
        socio({ id: 1, venceEl: null }),
        socio({ id: 2, venceEl: "2026-12-30" }),
        socio({ id: 3, venceEl: "2026-11-06" }),
        socio({ id: 4, venceEl: "2026-11-01" }), // dentro de la gracia
        socio({ id: 5, venceEl: "2026-10-30" }), // fuera de la gracia
        socio({ id: 6, venceEl: "2026-11-03" }), // vence hoy
      ],
      hoy,
      params,
    );
    expect(r.map((s) => s.estado)).toEqual(["sin_pagos", "pago", "por_vencer", "por_vencer", "vencido", "por_vencer"]);
    expect(r.map((s) => s.diasParaVencer)).toEqual([null, 57, 3, -2, -4, 0]);
  });

  it("conserva los datos originales del socio", () => {
    const [r] = agregarEstado([socio({ id: 9, nombre: "Zeta" })], hoy, params);
    expect(r?.id).toBe(9);
    expect(r?.nombre).toBe("Zeta");
  });
});

describe("nombreCompleto", () => {
  it('formatea "Apellido, Nombre"', () => {
    expect(nombreCompleto({ nombre: "Juan", apellido: "Pérez" })).toBe("Pérez, Juan");
  });
  it("sin apellido devuelve solo el nombre", () => {
    expect(nombreCompleto({ nombre: "Juan", apellido: null })).toBe("Juan");
    expect(nombreCompleto({ nombre: "Juan", apellido: "" })).toBe("Juan");
  });
});
