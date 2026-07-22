"use client";

import type { OcrProvider, ResultadoOcr } from "./types";

/**
 * Proveedor de OCR en servidor: envía la foto (ya comprimida) a /api/ocr,
 * que la procesa con PP-OCRv5 (modelo latino) en el microservicio Docker.
 * Precisión muy superior al OCR local en fotos reales de móvil.
 *
 * Lanza si no hay conexión o el servicio falla: el proveedor híbrido se
 * encarga entonces del respaldo con tesseract.js local.
 */
export class ServidorOcrProvider implements OcrProvider {
  async reconocer(imagen: Blob): Promise<ResultadoOcr> {
    const formulario = new FormData();
    formulario.append("imagen", imagen, "foto.jpg");

    const respuesta = await fetch("/api/ocr", {
      method: "POST",
      body: formulario,
      signal: AbortSignal.timeout(25_000),
    });
    if (!respuesta.ok) {
      throw new Error(`OCR en servidor no disponible (HTTP ${respuesta.status})`);
    }

    const datos = (await respuesta.json()) as { texto: string; confianza: number };
    return { texto: datos.texto ?? "", confianza: datos.confianza };
  }
}
