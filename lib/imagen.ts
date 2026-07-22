"use client";

/**
 * Comprime y reorienta una foto capturada con el móvil antes de guardarla.
 *
 * Por qué importa para el rendimiento:
 *  - Las fotos del móvil pesan 2-4 MB; comprimidas quedan en ~200-400 KB.
 *  - La sincronización sin cobertura sube mucho más rápido (menos bytes).
 *  - Ocupa menos IndexedDB y menos memoria (miniaturas más ligeras).
 *  - La oficina carga las imágenes al instante.
 *  - Se hornea la orientación EXIF: la foto queda siempre derecha, sin depender
 *    de que cada navegador respete los metadatos.
 */
export async function comprimirImagen(
  entrada: Blob,
  opciones: { maxLado?: number; calidad?: number } = {}
): Promise<Blob> {
  const maxLado = opciones.maxLado ?? 1600;
  const calidad = opciones.calidad ?? 0.82;

  let ancho: number;
  let alto: number;
  let fuente: CanvasImageSource;

  try {
    const bitmap = await createImageBitmap(entrada, { imageOrientation: "from-image" });
    ancho = bitmap.width;
    alto = bitmap.height;
    fuente = bitmap;
  } catch {
    const img = await cargarImagen(entrada);
    ancho = img.naturalWidth;
    alto = img.naturalHeight;
    fuente = img;
  }

  const escala = Math.min(1, maxLado / Math.max(ancho, alto));
  const w = Math.max(1, Math.round(ancho * escala));
  const h = Math.max(1, Math.round(alto * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return entrada;
  ctx.drawImage(fuente, 0, 0, w, h);

  const comprimida = await canvasABlob(canvas, calidad);
  // Si por lo que sea la compresión no ayuda (imagen ya minúscula), se conserva
  // la original salvo que hubiera que reorientarla (escala < 1 implica recorte).
  if (comprimida && (comprimida.size < entrada.size || escala < 1)) return comprimida;
  return comprimida ?? entrada;
}

function canvasABlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", calidad);
    } else {
      // Respaldo para navegadores muy antiguos sin toBlob
      try {
        const dataUrl = canvas.toDataURL("image/jpeg", calidad);
        resolve(dataUrlABlob(dataUrl));
      } catch {
        resolve(null);
      }
    }
  });
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

function dataUrlABlob(dataUrl: string): Blob {
  const [cabecera, base64] = dataUrl.split(",");
  const tipo = /:(.*?);/.exec(cabecera)?.[1] ?? "image/jpeg";
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
