import { describe, expect, it } from "vitest";
import {
  calcularDimensionesLogo,
  esDataUrlLogoValida,
  excedeLimitePixeles,
  formatoSalida,
  fondoParaLuminancia,
  luminanciaPromedio,
  LADO_MAX_LOGO,
  LADO_MAX_LOGO_REDUCIDO,
  pasosDeSalida,
  MAX_BYTES_ORIGEN,
  MAX_CARACTERES_DATA_URL,
  MAX_PIXELES_ORIGEN,
  validarArchivoLogo,
} from "./logo";

describe("validarArchivoLogo", () => {
  it("acepta PNG, JPG y WebP", () => {
    expect(validarArchivoLogo({ type: "image/png", size: 1000 }).ok).toBe(true);
    expect(validarArchivoLogo({ type: "image/jpeg", size: 1000 }).ok).toBe(true);
    expect(validarArchivoLogo({ type: "image/webp", size: 1000 }).ok).toBe(true);
  });

  it("rechaza SVG y otros tipos", () => {
    for (const type of ["image/svg+xml", "image/gif", "application/pdf", ""]) {
      const r = validarArchivoLogo({ type, size: 1000 });
      expect(r.ok).toBe(false);
    }
  });

  it("rechaza un archivo vacío", () => {
    expect(validarArchivoLogo({ type: "image/png", size: 0 }).ok).toBe(false);
  });

  it("acepta justo el límite de tamaño y rechaza un byte más", () => {
    expect(validarArchivoLogo({ type: "image/png", size: MAX_BYTES_ORIGEN }).ok).toBe(true);
    expect(validarArchivoLogo({ type: "image/png", size: MAX_BYTES_ORIGEN + 1 }).ok).toBe(false);
  });

  it("el tipo MIME es sensible a mayúsculas: el navegador siempre lo da en minúsculas", () => {
    // Decisión: no se normaliza; File.type de un navegador viene en minúsculas, y rechazar es lo seguro.
    expect(validarArchivoLogo({ type: "IMAGE/PNG", size: 1000 }).ok).toBe(false);
    expect(validarArchivoLogo({ type: "image/jpg", size: 1000 }).ok).toBe(false);
  });

  it("el archivo vacío se informa antes que el tipo inválido", () => {
    const r = validarArchivoLogo({ type: "image/svg+xml", size: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("vacío");
  });

  it("el motivo de exceso de tamaño menciona 10 MB", () => {
    const r = validarArchivoLogo({ type: "image/png", size: MAX_BYTES_ORIGEN + 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("10 MB");
  });

  it("el motivo del rechazo está en español y es legible", () => {
    const r = validarArchivoLogo({ type: "image/svg+xml", size: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("SVG");
  });
});

describe("calcularDimensionesLogo", () => {
  it("achica una imagen grande conservando la proporción (horizontal)", () => {
    expect(calcularDimensionesLogo(2000, 1000)).toEqual({ ancho: 512, alto: 256 });
  });

  it("achica una imagen grande conservando la proporción (vertical)", () => {
    expect(calcularDimensionesLogo(1000, 2000)).toEqual({ ancho: 256, alto: 512 });
  });

  it("no agranda una imagen chica", () => {
    expect(calcularDimensionesLogo(300, 200)).toEqual({ ancho: 300, alto: 200 });
    expect(calcularDimensionesLogo(512, 512)).toEqual({ ancho: 512, alto: 512 });
  });

  it("nunca devuelve 0 px en una dimensión (imagen muy alargada)", () => {
    const r = calcularDimensionesLogo(5000, 1);
    expect(r.ancho).toBe(LADO_MAX_LOGO);
    expect(r.alto).toBe(1);
  });

  it("imágenes cuadradas muy chicas quedan igual (1x1, 16x16)", () => {
    expect(calcularDimensionesLogo(1, 1)).toEqual({ ancho: 1, alto: 1 });
    expect(calcularDimensionesLogo(16, 16)).toEqual({ ancho: 16, alto: 16 });
  });

  it("imagen cuadrada grande queda de LADO_MAX_LOGO x LADO_MAX_LOGO", () => {
    expect(calcularDimensionesLogo(4000, 4000)).toEqual({ ancho: LADO_MAX_LOGO, alto: LADO_MAX_LOGO });
  });

  it("513 px achica a 512 y 512 px queda igual (borde)", () => {
    expect(calcularDimensionesLogo(513, 513)).toEqual({ ancho: 512, alto: 512 });
    expect(calcularDimensionesLogo(512, 100)).toEqual({ ancho: 512, alto: 100 });
  });

  it("redondea al entero más cercano", () => {
    // 1000x333 -> escala 0.512 -> 512 x 170,496 -> 170; 1000x334 -> 171,008 -> 171
    expect(calcularDimensionesLogo(1000, 333)).toEqual({ ancho: 512, alto: 170 });
    expect(calcularDimensionesLogo(1000, 335)).toEqual({ ancho: 512, alto: 172 });
  });

  it("respeta un ladoMax personalizado", () => {
    expect(calcularDimensionesLogo(400, 200, 100)).toEqual({ ancho: 100, alto: 50 });
  });

  it("lanza error con Infinity y con alto 0", () => {
    expect(() => calcularDimensionesLogo(Number.POSITIVE_INFINITY, 100)).toThrow();
    expect(() => calcularDimensionesLogo(100, 0)).toThrow();
    expect(() => calcularDimensionesLogo(100, Number.NaN)).toThrow();
  });

  it("lanza error con dimensiones inválidas", () => {
    expect(() => calcularDimensionesLogo(0, 100)).toThrow();
    expect(() => calcularDimensionesLogo(100, -1)).toThrow();
    expect(() => calcularDimensionesLogo(Number.NaN, 100)).toThrow();
  });
});

describe("excedeLimitePixeles", () => {
  it("es false para una foto normal y true para una imagen gigante", () => {
    expect(excedeLimitePixeles(4000, 3000)).toBe(false); // 12 Mpx
    expect(excedeLimitePixeles(12000, 9000)).toBe(true); // 108 Mpx
  });

  it("el límite cae justo en MAX_PIXELES_ORIGEN", () => {
    expect(excedeLimitePixeles(MAX_PIXELES_ORIGEN, 1)).toBe(false);
    expect(excedeLimitePixeles(MAX_PIXELES_ORIGEN + 1, 1)).toBe(true);
  });
});

describe("esDataUrlLogoValida", () => {
  const pngCorta = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

  it("acepta una data URL de PNG, JPEG o WebP", () => {
    expect(esDataUrlLogoValida(pngCorta)).toBe(true);
    expect(esDataUrlLogoValida("data:image/jpeg;base64,/9j/4AAQ=")).toBe(true);
    expect(esDataUrlLogoValida("data:image/webp;base64,UklGRg==")).toBe(true);
  });

  it("rechaza esquemas peligrosos y tipos no admitidos", () => {
    expect(esDataUrlLogoValida("javascript:alert(1)")).toBe(false);
    expect(esDataUrlLogoValida("data:text/html;base64,PGh0bWw+")).toBe(false);
    expect(esDataUrlLogoValida("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(esDataUrlLogoValida("")).toBe(false);
  });

  it("rechaza texto que no es base64 válido", () => {
    expect(esDataUrlLogoValida("data:image/png;base64,ab cd")).toBe(false);
  });

  it("acepta una data URL de exactamente MAX_CARACTERES_DATA_URL y rechaza un carácter más", () => {
    const prefijo = "data:image/png;base64,";
    const justo = prefijo + "A".repeat(MAX_CARACTERES_DATA_URL - prefijo.length);
    expect(justo.length).toBe(MAX_CARACTERES_DATA_URL);
    expect(esDataUrlLogoValida(justo)).toBe(true);
    expect(esDataUrlLogoValida(`${justo}A`)).toBe(false);
  });

  it("rechaza data URL sin contenido, sin base64 o con tipo en mayúsculas", () => {
    expect(esDataUrlLogoValida("data:image/png;base64,")).toBe(false);
    expect(esDataUrlLogoValida("data:image/png,iVBORw0KGgo=")).toBe(false);
    expect(esDataUrlLogoValida("data:image/PNG;base64,iVBORw0KGgo=")).toBe(false);
    expect(esDataUrlLogoValida("data:image/gif;base64,R0lGODlh")).toBe(false);
  });

  it("rechaza relleno '=' en medio, saltos de línea y texto extra antes o después", () => {
    expect(esDataUrlLogoValida("data:image/png;base64,iVB=ORw0")).toBe(false);
    expect(esDataUrlLogoValida("data:image/png;base64,iVBORw0\n")).toBe(false);
    expect(esDataUrlLogoValida(" data:image/png;base64,iVBORw0")).toBe(false);
    expect(esDataUrlLogoValida("data:image/png;base64,iVBORw0\"onerror=\"x")).toBe(false);
  });

  it("rechaza una data URL que supera el tope de caracteres", () => {
    const grande = `data:image/png;base64,${"A".repeat(MAX_CARACTERES_DATA_URL)}`;
    expect(esDataUrlLogoValida(grande)).toBe(false);
  });
});

describe("formatoSalida", () => {
  it("JPG se exporta como JPEG", () => {
    expect(formatoSalida("image/jpeg")).toBe("image/jpeg");
  });

  it("PNG y WebP se exportan como PNG (conservan transparencia)", () => {
    expect(formatoSalida("image/png")).toBe("image/png");
    expect(formatoSalida("image/webp")).toBe("image/png");
  });

  it("un tipo desconocido o vacío cae en PNG", () => {
    expect(formatoSalida("")).toBe("image/png");
    expect(formatoSalida("image/gif")).toBe("image/png");
  });
});

describe("pasosDeSalida", () => {
  it("el primer intento es el formato de origen; después, WebP y finalmente un tamaño menor", () => {
    const pasos = pasosDeSalida("image/png");
    expect(pasos[0]?.formato).toBe("image/png");
    expect(pasos[1]?.formato).toBe("image/webp");
    expect(pasos[2]).toEqual({ formato: "image/webp", calidad: 0.8, ladoMax: LADO_MAX_LOGO_REDUCIDO });
  });

  it("una imagen JPG empieza en JPEG", () => {
    expect(pasosDeSalida("image/jpeg")[0]?.formato).toBe("image/jpeg");
  });

  it("los tamaños nunca crecen de un intento al siguiente", () => {
    const pasos = pasosDeSalida("image/webp");
    for (let i = 1; i < pasos.length; i++) {
      expect(pasos[i]?.ladoMax ?? 0).toBeLessThanOrEqual(pasos[i - 1]?.ladoMax ?? 0);
    }
  });
});

describe("luminanciaPromedio", () => {
  it("un píxel blanco opaco da 1 y uno negro opaco da 0", () => {
    expect(luminanciaPromedio([255, 255, 255, 255])).toBeCloseTo(1);
    expect(luminanciaPromedio([0, 0, 0, 255])).toBeCloseTo(0);
  });

  it("ignora los píxeles transparentes", () => {
    // Un blanco opaco y un negro totalmente transparente: solo cuenta el blanco.
    expect(luminanciaPromedio([255, 255, 255, 255, 0, 0, 0, 0])).toBeCloseTo(1);
  });

  it("devuelve null si no hay píxeles visibles", () => {
    expect(luminanciaPromedio([255, 255, 255, 0])).toBe(null);
    expect(luminanciaPromedio([])).toBe(null);
  });
});

describe("fondoParaLuminancia", () => {
  it("un logo claro va sobre caja oscura, y uno oscuro sobre caja clara", () => {
    expect(fondoParaLuminancia(0.9)).toBe("oscuro");
    expect(fondoParaLuminancia(0.1)).toBe("claro");
  });

  it("sin píxeles visibles usa la caja clara de siempre", () => {
    expect(fondoParaLuminancia(null)).toBe("claro");
  });
});
