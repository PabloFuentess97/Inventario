"use client";

import type { OcrProvider, ResultadoOcr } from "./types";

/**
 * Proveedor de OCR por defecto: tesseract.js ejecutado EN EL NAVEGADOR.
 *
 * Ventajas para este caso de uso:
 *  - Funciona sin servicios externos ni coste por petición.
 *  - Funciona SIN CONEXIÓN: los assets (worker, wasm y el idioma español)
 *    se sirven desde /public/tesseract y el service worker los cachea,
 *    así el OCR sigue disponible en zonas del almacén sin cobertura.
 *
 * Las fotos del móvil llegan enormes (4000×3000), con poco contraste y mucho
 * fondo que no es texto; sobre ellas tesseract "alucina" caracteres raros. Por
 * eso, antes de reconocer, se PREPROCESA la imagen: se reorienta según EXIF, se
 * reduce a un tamaño razonable y se pasa a escala de grises con más contraste.
 *
 * Los assets se copian desde node_modules con: npm run ocr:assets
 */
export class TesseractOcrProvider implements OcrProvider {
  private workerPromise: Promise<import("tesseract.js").Worker> | null = null;

  private async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("spa", 1, {
          workerPath: "/tesseract/worker.min.js",
          corePath: "/tesseract/core",
          langPath: "/tesseract/lang",
          logger: () => {},
        });
        // DPI fijo (evita la mala estimación de resolución) y conservar espacios.
        await worker.setParameters({
          user_defined_dpi: "300",
          preserve_interword_spaces: "1",
        });
        return worker;
      })();
    }
    return this.workerPromise;
  }

  async reconocer(imagen: Blob): Promise<ResultadoOcr> {
    const worker = await this.getWorker();
    // Preprocesado: clave para que el OCR no devuelva basura en fotos de móvil.
    const preparada = await preprocesar(imagen);
    const { data } = await worker.recognize(preparada);
    return {
      texto: limpiarTextoOcr(data.text),
      confianza: data.confidence,
    };
  }
}

/**
 * Prepara la foto para el OCR:
 *  - Reorienta según los metadatos EXIF (fotos verticales del móvil).
 *  - Reduce el lado mayor a 1600 px (más rápido y evita fallos de memoria).
 *  - Escala de grises + contraste, que es lo que mejor lee tesseract.
 * Devuelve una data URL PNG lista para reconocer.
 */
async function preprocesar(blob: Blob): Promise<string> {
  const MAX = 1600;

  let ancho: number;
  let alto: number;
  let fuente: CanvasImageSource;

  try {
    // createImageBitmap aplica la orientación EXIF de forma fiable
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    ancho = bitmap.width;
    alto = bitmap.height;
    fuente = bitmap;
  } catch {
    // Respaldo para navegadores sin la opción imageOrientation
    const img = await cargarImagen(blob);
    ancho = img.naturalWidth;
    alto = img.naturalHeight;
    fuente = img;
  }

  const escala = Math.min(1, MAX / Math.max(ancho, alto));
  const w = Math.max(1, Math.round(ancho * escala));
  const h = Math.max(1, Math.round(alto * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blobAUrl(blob); // sin canvas, se usa la imagen tal cual
  ctx.drawImage(fuente, 0, 0, w, h);

  // Escala de grises + contraste manuales (compatibles con iOS Safari antiguo,
  // donde ctx.filter no está soportado).
  try {
    const imagenData = ctx.getImageData(0, 0, w, h);
    const d = imagenData.data;
    const contraste = 1.5;
    const desplazamiento = 128 * (1 - contraste);
    for (let i = 0; i < d.length; i += 4) {
      const gris = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = gris * contraste + desplazamiento;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imagenData, 0, 0);
  } catch {
    // getImageData puede fallar por seguridad en algún caso raro: se ignora.
  }

  return canvas.toDataURL("image/png");
}

function cargarImagen(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = url;
  });
}

/** tesseract.js acepta data URLs. */
function blobAUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.readAsDataURL(blob);
  });
}

// Caracteres que tienen sentido en una etiqueta; el resto se descarta.
const CARACTERES_VALIDOS = /[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ .,:;/%()+\-×°#&'ª]/g;
const ALFANUMERICO = /[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g;

/**
 * Limpia el texto del OCR: quita caracteres imposibles en una etiqueta y
 * descarta las líneas que son mayoritariamente símbolos (basura del OCR).
 */
function limpiarTextoOcr(texto: string): string {
  return texto
    .split("\n")
    .map((linea) => linea.replace(CARACTERES_VALIDOS, " ").replace(/\s+/g, " ").trim())
    .filter((linea) => {
      if (linea.length < 2) return false;
      const alfanumericos = (linea.match(ALFANUMERICO) || []).length;
      // Si menos del 40 % de la línea son letras/números, es ruido: se descarta.
      return alfanumericos / linea.length >= 0.4;
    })
    .join("\n")
    .trim();
}
