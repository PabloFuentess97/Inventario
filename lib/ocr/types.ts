/**
 * Adaptador de OCR intercambiable.
 *
 * La app solo conoce esta interfaz: cambiar de motor (tesseract.js local,
 * Google Cloud Vision, AWS Textract, Azure…) no requiere tocar el resto
 * del código, solo registrar otro proveedor en lib/ocr/index.ts.
 */
export interface ResultadoOcr {
  /** Texto crudo reconocido en la imagen (se guarda tal cual en textoOcr). */
  texto: string;
  /** Confianza media 0-100, si el motor la proporciona. */
  confianza?: number;
}

export interface OcrProvider {
  /** Reconoce el texto de una imagen de etiqueta. */
  reconocer(imagen: Blob): Promise<ResultadoOcr>;
  /**
   * Inicializa el motor por adelantado (opcional). Llamarlo al entrar en el
   * recuento evita que la primera foto espere a que cargue el WASM.
   */
  precalentar?(): void;
}
