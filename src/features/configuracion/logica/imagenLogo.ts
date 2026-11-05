/**
 * Procesa la imagen elegida para el logo: la lee, la achica y la devuelve como data URL.
 * Parte con DOM (FileReader, Image, canvas): no tiene tests unitarios. La lógica de decisión
 * (tamaños, límites, formato) está en logo.ts y sí está testeada.
 *
 * Nota de CSP: se usa FileReader (data URL) y NO URL.createObjectURL, porque la CSP de la app no
 * permite blob: en img-src. Si alguna vez se cambia a blob:, hay que tocar tauri.conf.json.
 */
import {
  calcularDimensionesLogo,
  esDataUrlLogoValida,
  excedeLimitePixeles,
  pasosDeSalida,
} from "./logo";

const MSJ_LEER_ARCHIVO = "No se pudo leer el archivo elegido.";

function leerComoDataUrl(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result === "string") resolve(lector.result);
      else reject(new Error(MSJ_LEER_ARCHIVO));
    };
    lector.onerror = () => reject(new Error(MSJ_LEER_ARCHIVO));
    lector.readAsDataURL(archivo);
  });
}

function cargarImagen(origen: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // Si el archivo tiene extensión de imagen pero no lo es (ej. un .txt renombrado), falla acá.
    img.onerror = () => reject(new Error("No se pudo leer la imagen. ¿Está dañada o no es una imagen?"));
    img.src = origen;
  });
}

/**
 * Devuelve el logo listo para guardar (data URL, achicado). Prueba los pasos de pasosDeSalida en orden
 * hasta que quepa. Lanza un Error con mensaje para el usuario.
 */
export async function procesarImagenLogo(archivo: File): Promise<string> {
  const origen = await leerComoDataUrl(archivo);
  const img = await cargarImagen(origen);

  if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    throw new Error("No se pudo leer la imagen. ¿Está dañada o no es una imagen?");
  }
  // Antes de dibujar: una imagen gigante colgaría la ventana.
  if (excedeLimitePixeles(img.naturalWidth, img.naturalHeight)) {
    throw new Error("La imagen tiene demasiados píxeles. Probá con una más chica.");
  }

  const canvas = document.createElement("canvas");
  try {
    for (const paso of pasosDeSalida(archivo.type)) {
      const { ancho, alto } = calcularDimensionesLogo(img.naturalWidth, img.naturalHeight, paso.ladoMax);
      canvas.width = ancho; // cambiar el tamaño limpia el canvas
      canvas.height = alto;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("El navegador no pudo preparar la imagen.");
      // Calidad alta al achicar: sin esto, una foto reducida sale con dientes de sierra.
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, ancho, alto);

      const salida = canvas.toDataURL(paso.formato, paso.calidad);
      // Si el canvas no pudo exportar (devuelve "data:,"), esto no pasa la validación.
      if (esDataUrlLogoValida(salida)) return salida;
    }
    throw new Error("La imagen es demasiado compleja para guardarla como logo. Probá con una versión más simple.");
  } finally {
    // Libera la memoria del canvas aunque algo haya fallado en el medio.
    canvas.width = 0;
    canvas.height = 0;
  }
}
