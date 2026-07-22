import { NextResponse } from "next/server";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

/**
 * Proxy autenticado hacia el microservicio de OCR (PP-OCRv5, servicio "ocr"
 * de docker-compose). El móvil lo usa cuando tiene conexión: mucha más
 * precisión que el OCR local; sin conexión, el cliente recurre a tesseract.js.
 *
 * Si OCR_SERVICE_URL no está configurada, responde 503 y el cliente hace
 * fallback local de forma transparente.
 */
export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OPERARIO"]);

  const base = process.env.OCR_SERVICE_URL;
  if (!base) throw new ApiError(503, "OCR en servidor no configurado");

  const formulario = await peticion.formData();
  const imagen = formulario.get("imagen");
  if (!(imagen instanceof File)) throw new ApiError(400, "Falta la imagen");

  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? 10);
  if (imagen.size > maxMb * 1024 * 1024) {
    throw new ApiError(413, `La imagen supera el máximo de ${maxMb} MB`);
  }

  const reenvio = new FormData();
  reenvio.append("imagen", imagen, "foto.jpg");

  const respuesta = await fetch(`${base}/ocr`, {
    method: "POST",
    body: reenvio,
    // El OCR tarda ~1-3 s por foto en CPU; margen amplio sin colgar la API
    signal: AbortSignal.timeout(20_000),
  });

  if (!respuesta.ok) {
    throw new ApiError(502, "El servicio de OCR no está disponible");
  }

  return NextResponse.json(await respuesta.json());
});
