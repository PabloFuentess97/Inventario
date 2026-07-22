import type { OcrProvider, ResultadoOcr } from "./types";

/**
 * Adaptador alternativo de OCR en la nube (Google Cloud Vision).
 *
 * Preparado pero NO activo. Útil si en producción se necesita más precisión
 * que la de tesseract.js con etiquetas difíciles (arrugadas, poca luz…).
 *
 * Para activarlo:
 *   1. npm install @google-cloud/vision
 *   2. Configurar en .env:
 *        OCR_PROVIDER="cloud"
 *        GOOGLE_APPLICATION_CREDENTIALS="ruta/a/credenciales.json"
 *   3. Descomentar la implementación de abajo.
 *   4. Este proveedor se ejecuta EN SERVIDOR (necesita credenciales), por lo
 *      que la UI debería enviar la foto a un endpoint /api/ocr cuando haya
 *      conexión, y recurrir a tesseract.js local como respaldo offline.
 *
 * Equivalentes con otros proveedores:
 *   - AWS Textract:  @aws-sdk/client-textract  → DetectDocumentTextCommand
 *   - Azure Vision:  @azure-rest/ai-vision-image-analysis → readText
 */
export class CloudVisionOcrProvider implements OcrProvider {
  constructor() {
    throw new Error(
      "El OCR en la nube no está activado. Instala @google-cloud/vision y descomenta lib/ocr/cloud-provider.ts"
    );
  }

  async reconocer(_imagen: Blob): Promise<ResultadoOcr> {
    throw new Error("No implementado");
  }
}

/* ── Implementación de referencia (descomentar tras instalar el SDK) ──────────

import vision from "@google-cloud/vision";

export class CloudVisionOcrProvider implements OcrProvider {
  private cliente = new vision.ImageAnnotatorClient();

  async reconocer(imagen: Blob): Promise<ResultadoOcr> {
    const buffer = Buffer.from(await imagen.arrayBuffer());
    const [resultado] = await this.cliente.textDetection({ image: { content: buffer } });
    const texto = resultado.fullTextAnnotation?.text ?? "";
    return { texto: texto.trim() };
  }
}
────────────────────────────────────────────────────────────────────────────── */
