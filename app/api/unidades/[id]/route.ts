import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  codigo: z.string().min(1).max(20).transform((c) => c.toUpperCase()).optional(),
  nombre: z.string().min(1).max(100).optional(),
  activa: z.boolean().optional(),
});

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());
  const unidad = await prisma.unidadMedida.update({ where: { id }, data: datos });
  return NextResponse.json({ unidad });
});

export const DELETE = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const enUso = await prisma.lineaRecuento.count({ where: { unidadMedidaId: id } });
  if (enUso > 0) {
    // Se desactiva en lugar de borrar para no romper la trazabilidad
    await prisma.unidadMedida.update({ where: { id }, data: { activa: false } });
    return NextResponse.json({ ok: true, desactivada: true });
  }
  await prisma.unidadMedida.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
