import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  pasilloId: z.string(),
  codigo: z.string().min(1).max(50),
  descripcion: z.string().max(500).optional().nullable(),
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());

  const pasillo = await prisma.pasillo.findUnique({ where: { id: datos.pasilloId } });
  if (!pasillo) throw new ApiError(404, "El pasillo no existe");

  const estanteria = await prisma.$transaction(async (tx) => {
    // Reactivar la rama: pasillo y almacén. Si quedaran archivados, la
    // estantería nueva no aparecería ni en la oficina ni en el móvil.
    await tx.pasillo.update({ where: { id: datos.pasilloId }, data: { archivada: false } });
    await tx.almacen.update({ where: { id: pasillo.almacenId }, data: { archivada: false } });
    return tx.estanteria.create({ data: datos });
  });

  return NextResponse.json({ estanteria }, { status: 201 });
});
