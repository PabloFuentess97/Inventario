import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  codigo: z.string().min(1).max(20).transform((c) => c.toUpperCase()).optional(),
  nombre: z.string().min(1).max(100).optional(),
  activa: z.boolean().optional(),
  /** Marcarla como la unidad que se asigna sola al contar. */
  porDefecto: z.boolean().optional(),
});

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());

  // Solo puede haber una unidad por defecto: se desmarca la anterior primero
  // (además de la restricción única parcial de la base de datos).
  if (datos.porDefecto === true) {
    const unidad = await prisma.$transaction(async (tx) => {
      await tx.unidadMedida.updateMany({
        where: { porDefecto: true, id: { not: id } },
        data: { porDefecto: false },
      });
      // Una unidad desactivada no puede ser la de por defecto
      return tx.unidadMedida.update({
        where: { id },
        data: { ...datos, activa: true },
      });
    });
    return NextResponse.json({ unidad });
  }

  // Desactivar la unidad por defecto la deja de serlo (no puede quedar oculta
  // y a la vez asignarse automáticamente).
  const datosFinales = datos.activa === false ? { ...datos, porDefecto: false } : datos;
  const unidad = await prisma.unidadMedida.update({ where: { id }, data: datosFinales });
  return NextResponse.json({ unidad });
});

export const DELETE = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;

  const unidad = await prisma.unidadMedida.findUnique({ where: { id } });
  if (!unidad) throw new ApiError(404, "La unidad no existe");
  if (unidad.porDefecto) {
    throw new ApiError(
      409,
      "No se puede eliminar la unidad por defecto. Marca otra como predeterminada primero."
    );
  }

  const enUso = await prisma.lineaRecuento.count({ where: { unidadMedidaId: id } });
  if (enUso > 0) {
    // Se desactiva en lugar de borrar para no romper la trazabilidad
    await prisma.unidadMedida.update({ where: { id }, data: { activa: false } });
    return NextResponse.json({ ok: true, desactivada: true });
  }
  await prisma.unidadMedida.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
