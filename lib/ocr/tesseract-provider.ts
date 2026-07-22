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
 * Los assets se copian desde node_modules con: npm run ocr:assets
 */
export class TesseractOcrProvider implements OcrProvider {
  private workerPromise: Promise<import("tesseract.js").Worker> | null = null;

  private async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        const { createWorker } = await import("tesseract.js");
        return createWorker("spa", 1, {
          workerPath: "/tesseract/worker.min.js",
          corePath: "/tesseract/core",
          langPath: "/tesseract/lang",
          // Silenciar logs de progreso en producción
          logger: () => {},
        });
      })();
    }
    return this.workerPromise;
  }

  async reconocer(imagen: Blob): Promise<ResultadoOcr> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(await blobAUrl(imagen));
    return {
      texto: limpiarTextoOcr(data.text),
      confianza: data.confidence,
    };
  }
}

/** tesseract.js acepta data URLs; convertimos el Blob para evitar problemas con object URLs en workers. */
function blobAUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.readAsDataURL(blob);
  });
}

/** Normaliza el texto OCR: colapsa espacios y elimina líneas vacías repetidas. */
function limpiarTextoOcr(texto: string): string {
  return texto
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}
