import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  codigo: z.string().min(1).max(50).optional(),
  nombre: z.string().min(1).max(200).optional(),
});

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());
  const estancia = await prisma.estancia.update({ where: { id }, data: datos });
  return NextResponse.json({ estancia });
});

export const DELETE = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const conRecuentos = await prisma.recuento.count({
    where: { ubicacion: { estanteria: { estanciaId: id } } },
  });
  if (conRecuentos > 0) {
    throw new ApiError(409, "No se puede eliminar: la estancia tiene recuentos registrados");
  }
  await prisma.estancia.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
