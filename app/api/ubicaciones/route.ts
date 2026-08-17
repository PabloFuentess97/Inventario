import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";
import { reactivarRama } from "@/lib/estructura";

const schema = z.object({
  estanteriaId: z.string(),
  codigo: z.string().min(1).max(50),
  nivel: z.number().int().min(0).optional().nullable(),
  hueco: z.number().int().min(0).optional().nullable(),
  descripcion: z.string().max(500).optional().nullable(),
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());

  const estanteria = await prisma.estanteria.findUnique({ where: { id: datos.estanteriaId } });
  if (!estanteria) throw new ApiError(404, "La estantería no existe");

  // Si la rama estaba archivada se reactiva: una ubicación nueva dentro de una
  // estantería archivada nunca llegaría al móvil del operario.
  await reactivarRama(datos.estanteriaId);
  const ubicacion = await prisma.ubicacion.create({ data: datos });

  return NextResponse.json({ ubicacion }, { status: 201 });
});
