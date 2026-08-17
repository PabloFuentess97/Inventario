import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  almacenId: z.string(),
  codigo: z.string().min(1).max(50),
  nombre: z.string().min(1).max(200),
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());

  const pasillo = await prisma.$transaction(async (tx) => {
    // Si el almacén estaba archivado, se reactiva: al añadirle un pasillo
    // se vuelve a usar, y si no el pasillo nuevo sería invisible.
    await tx.almacen.update({ where: { id: datos.almacenId }, data: { archivada: false } });
    return tx.pasillo.create({ data: datos });
  });

  return NextResponse.json({ pasillo }, { status: 201 });
});
