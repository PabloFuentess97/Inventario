import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({ archivado: z.boolean() });

type Contexto = { params: Promise<{ id: string }> };

/**
 * Borrado lógico de un recuento (solo ADMIN).
 *
 * No borra nada: el recuento y sus líneas siguen en la base de datos, pero
 * desaparecen de los listados y de los informes. Es reversible (archivado:false).
 * Se usa para descartar recuentos erróneos sin perder la trazabilidad.
 */
export const POST = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["ADMIN"]);
  const { id } = await params;
  const { archivado } = schema.parse(await peticion.json());

  const recuento = await prisma.recuento.findUnique({ where: { id } });
  if (!recuento) throw new ApiError(404, "Recuento no encontrado");
  if (recuento.estado === "EN_PROGRESO" && archivado) {
    throw new ApiError(
      409,
      "No se puede archivar un recuento en curso. Espera a que el operario lo finalice."
    );
  }

  const actualizado = await prisma.recuento.update({ where: { id }, data: { archivado } });
  return NextResponse.json({ recuento: actualizado });
});
