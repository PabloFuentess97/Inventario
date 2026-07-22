"use client";

import type { OcrProvider, ResultadoOcr } from "./types";
import { ServidorOcrProvider } from "./servidor-provider";
import { TesseractOcrProvider } from "./tesseract-provider";

/**
 * Proveedor HÍBRIDO de OCR:
 *
 *  1. Con conexión → OCR en servidor (PP-OCRv5 latino, microservicio Docker):
 *     la máxima precisión con fotos reales de móvil (tildes y espacios bien).
 *  2. Sin conexión o si el servidor falla → tesseract.js EN el dispositivo:
 *     el flujo de recuento nunca se detiene por falta de cobertura.
 *
 * El resto de la app solo conoce la interfaz OcrProvider.
 */
class OcrHibrido implements OcrProvider {
  private servidor = new ServidorOcrProvider();
  private local = new TesseractOcrProvider();

  precalentar(): void {
    // Solo hace falta precalentar el motor local (WASM); el servidor ya está.
    this.local.precalentar();
  }

  async reconocer(imagen: Blob): Promise<ResultadoOcr> {
    if (typeof navigator === "undefined" || navigator.onLine) {
      try {
        return await this.servidor.reconocer(imagen);
      } catch {
        // Servidor caído o red inestable: respaldo local transparente
      }
    }
    return this.local.reconocer(imagen);
  }
}

let instancia: OcrProvider | null = null;

/** Devuelve el proveedor de OCR activo (híbrido servidor + local). */
export function getOcr(): OcrProvider {
  if (!instancia) {
    instancia = new OcrHibrido();
  }
  return instancia;
}

export type { OcrProvider, ResultadoOcr } from "./types";
