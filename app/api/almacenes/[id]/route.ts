import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  descripcion: z.string().max(1000).optional().nullable(),
});

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());
  const almacen = await prisma.almacen.update({ where: { id }, data: datos });
  return NextResponse.json({ almacen });
});

export const DELETE = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  // No se permite borrar un almacén con recuentos registrados (trazabilidad)
  const conRecuentos = await prisma.recuento.count({
    where: { ubicacion: { estanteria: { estancia: { almacenId: id } } } },
  });
  if (conRecuentos > 0) {
    throw new ApiError(409, "No se puede eliminar: el almacén tiene recuentos registrados");
  }
  await prisma.almacen.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
