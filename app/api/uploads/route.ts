import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

// El cliente siempre comprime a JPEG antes de subir. Se aceptan además otros
// formatos de imagen por robustez (tipo vacío en algunos navegadores, etc.);
// lo importante es no rechazar una subida válida y dejar la foto atascada.
function esImagenAceptable(tipo: string): boolean {
  return tipo === "" || tipo.startsWith("image/");
}

/**
 * Subida de fotos (etiquetas e incidencias), en diferido desde el outbox.
 * Idempotente: el nombre del archivo deriva del fotoId generado en cliente,
 * así que resubir la misma foto sobrescribe en lugar de duplicar.
 */
export const POST = conManejadorErrores(async (peticion: Request) => {
  const sesion = await requireSesion(["OPERARIO"]);

  const formulario = await peticion.formData();
  const archivo = formulario.get("archivo");
  const destino = formulario.get("destino");
  const entidadId = formulario.get("entidadId");
  const fotoId = formulario.get("fotoId");

  if (!(archivo instanceof File)) throw new ApiError(400, "Falta el archivo");
  if (destino !== "linea" && destino !== "incidencia") throw new ApiError(400, "Destino no válido");
  if (typeof entidadId !== "string" || typeof fotoId !== "string") {
    throw new ApiError(400, "Faltan identificadores");
  }

  const maxMb = Number(process.env.MAX_UPLOAD_MB ?? 10);
  if (archivo.size > maxMb * 1024 * 1024) {
    throw new ApiError(413, `La imagen supera el máximo de ${maxMb} MB`);
  }
  if (!esImagenAceptable(archivo.type)) {
    throw new ApiError(415, "El archivo no es una imagen");
  }

  const buffer = Buffer.from(await archivo.arrayBuffer());

  if (destino === "linea") {
    const linea = await prisma.lineaRecuento.findUnique({
      where: { id: entidadId },
      include: { recuento: true },
    });
    if (!linea) throw new ApiError(404, "La línea aún no existe en el servidor");
    if (linea.recuento.operarioId !== sesion.user.id) {
      throw new ApiError(403, "La línea pertenece a otro operario");
    }
    const url = await getStorage().guardar(buffer, fotoId, archivo.type);
    await prisma.lineaRecuento.update({ where: { id: entidadId }, data: { fotoEtiquetaUrl: url } });
    return NextResponse.json({ url });
  }

  const incidencia = await prisma.incidencia.findUnique({
    where: { id: entidadId },
    include: { linea: { include: { recuento: true } } },
  });
  if (!incidencia) throw new ApiError(404, "La incidencia aún no existe en el servidor");
  if (incidencia.linea.recuento.operarioId !== sesion.user.id) {
    throw new ApiError(403, "La incidencia pertenece a otro operario");
  }
  const url = await getStorage().guardar(buffer, fotoId, archivo.type);
  await prisma.incidencia.update({ where: { id: entidadId }, data: { fotoUrl: url } });
  return NextResponse.json({ url });
});
