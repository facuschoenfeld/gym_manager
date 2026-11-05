import { describe, expect, it } from "vitest";
import type { Config } from "@/db/queries/config";
import { configAFormulario, esquemaConfiguracion } from "./configuracion";

const valido = {
  nombre_gimnasio: "Gimnasio Test",
  dias_por_vencer: "5",
  dias_gracia: "0",
  regla_vencimiento: "desde_vencimiento_anterior",
  codigo_area: "3482",
  plantilla_aviso: "Hola {nombre}",
};

describe("esquemaConfiguracion", () => {
  it("acepta una configuración válida y convierte los días a número", () => {
    const r = esquemaConfiguracion.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        nombre_gimnasio: "Gimnasio Test",
        dias_por_vencer: 5,
        dias_gracia: 0,
        regla_vencimiento: "desde_vencimiento_anterior",
        codigo_area: "3482",
        plantilla_aviso: "Hola {nombre}",
      });
    }
  });

  it("rechaza nombre vacío o de más de 80 caracteres", () => {
    expect(esquemaConfiguracion.safeParse({ ...valido, nombre_gimnasio: "  " }).success).toBe(false);
    expect(esquemaConfiguracion.safeParse({ ...valido, nombre_gimnasio: "a".repeat(81) }).success).toBe(false);
    expect(esquemaConfiguracion.safeParse({ ...valido, nombre_gimnasio: "a".repeat(80) }).success).toBe(true);
  });

  it.each(["dias_por_vencer", "dias_gracia"] as const)("%s: rechaza negativos, no numéricos, vacíos y 61", (campo) => {
    for (const v of ["-1", "abc", "", "1.5", "61"]) {
      expect(esquemaConfiguracion.safeParse({ ...valido, [campo]: v }).success).toBe(false);
    }
  });

  it.each(["dias_por_vencer", "dias_gracia"] as const)("%s: acepta 0 y 60", (campo) => {
    expect(esquemaConfiguracion.safeParse({ ...valido, [campo]: "0" }).success).toBe(true);
    expect(esquemaConfiguracion.safeParse({ ...valido, [campo]: "60" }).success).toBe(true);
  });

  it("rechaza una regla de vencimiento desconocida y acepta desde_fecha_pago", () => {
    expect(esquemaConfiguracion.safeParse({ ...valido, regla_vencimiento: "otra" }).success).toBe(false);
    expect(esquemaConfiguracion.safeParse({ ...valido, regla_vencimiento: "desde_fecha_pago" }).success).toBe(true);
  });

  it('código de área "03482" se normaliza a "3482"', () => {
    const r = esquemaConfiguracion.safeParse({ ...valido, codigo_area: "03482" });
    expect(r.success && r.data.codigo_area).toBe("3482");
  });

  it("código de área vacío es válido", () => {
    const r = esquemaConfiguracion.safeParse({ ...valido, codigo_area: "" });
    expect(r.success && r.data.codigo_area).toBe("");
  });

  it("código de área con 12345 o 3 es inválido", () => {
    expect(esquemaConfiguracion.safeParse({ ...valido, codigo_area: "12345" }).success).toBe(false);
    expect(esquemaConfiguracion.safeParse({ ...valido, codigo_area: "3" }).success).toBe(false);
  });

  it("código de área ignora caracteres no numéricos", () => {
    const r = esquemaConfiguracion.safeParse({ ...valido, codigo_area: " (0341) " });
    expect(r.success && r.data.codigo_area).toBe("341");
  });
});

describe("configAFormulario", () => {
  it("convierte los números a texto y conserva el resto", () => {
    const config: Config = {
      nombre_gimnasio: "Mi Gym",
      dias_por_vencer: 7,
      dias_gracia: 2,
      regla_vencimiento: "desde_fecha_pago",
      plantilla_aviso: "",
      codigo_area: "3482",
      carpeta_respaldos: "",
      respaldos_a_conservar: 14,
      ultimo_respaldo: "",
      mapeo_importacion: "",
    };
    expect(configAFormulario(config)).toEqual({
      nombre_gimnasio: "Mi Gym",
      dias_por_vencer: "7",
      dias_gracia: "2",
      regla_vencimiento: "desde_fecha_pago",
      codigo_area: "3482",
      plantilla_aviso: "",
    });
  });

  it("ida y vuelta: el formulario generado pasa el esquema", () => {
    const config: Config = {
      nombre_gimnasio: "Mi Gym",
      dias_por_vencer: 5,
      dias_gracia: 0,
      regla_vencimiento: "desde_vencimiento_anterior",
      plantilla_aviso: "",
      codigo_area: "3482",
      carpeta_respaldos: "",
      respaldos_a_conservar: 14,
      ultimo_respaldo: "",
      mapeo_importacion: "",
    };
    const r = esquemaConfiguracion.safeParse(configAFormulario(config));
    expect(r.success).toBe(true);
  });
});
