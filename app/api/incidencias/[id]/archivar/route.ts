import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({ archivada: z.boolean() });

type Contexto = { params: Promise<{ id: string }> };

/**
 * Borrado lógico de una incidencia (solo ADMIN).
 * La incidencia y su línea contada se conservan; solo deja de aparecer en el
 * panel de incidencias. Reversible.
 */
export const POST = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["ADMIN"]);
  const { id } = await params;
  const { archivada } = schema.parse(await peticion.json());

  const incidencia = await prisma.incidencia.findUnique({ where: { id } });
  if (!incidencia) throw new ApiError(404, "Incidencia no encontrada");

  const actualizada = await prisma.incidencia.update({ where: { id }, data: { archivada } });
  return NextResponse.json({ incidencia: actualizada });
});
