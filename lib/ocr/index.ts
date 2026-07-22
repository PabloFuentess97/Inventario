"use client";

import type { OcrProvider } from "./types";
import { TesseractOcrProvider } from "./tesseract-provider";

let instancia: OcrProvider | null = null;

/**
 * Devuelve el proveedor de OCR activo.
 * Por defecto tesseract.js en cliente (funciona offline).
 * Ver lib/ocr/cloud-provider.ts para la alternativa en la nube.
 */
export function getOcr(): OcrProvider {
  if (!instancia) {
    instancia = new TesseractOcrProvider();
  }
  return instancia;
}

export type { OcrProvider, ResultadoOcr } from "./types";
