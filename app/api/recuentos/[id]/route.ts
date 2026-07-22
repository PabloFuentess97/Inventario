import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

type Contexto = { params: Promise<{ id: string }> };

/** Detalle de un recuento con sus líneas (oficina). */
export const GET = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;

  const recuento = await prisma.recuento.findUnique({
    where: { id },
    include: {
      operario: { select: { nombre: true, nbi: true } },
      ubicacion: {
        include: { estanteria: { include: { estancia: { include: { almacen: true } } } } },
      },
      lineas: {
        orderBy: { createdAt: "asc" },
        include: {
          unidadMedida: true,
          incidencia: { include: { resueltaPor: { select: { nombre: true } } } },
        },
      },
    },
  });
  if (!recuento) throw new ApiError(404, "Recuento no encontrado");
  return NextResponse.json({ recuento });
});

const patchSchema = z.object({
  accion: z.literal("reabrir"),
});

/**
 * Reapertura de un recuento finalizado (solo oficina).
 * Falla si otro operario ya tiene un recuento EN_PROGRESO en la ubicación.
 */
export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  patchSchema.parse(await peticion.json());

  const recuento = await prisma.recuento.findUnique({ where: { id } });
  if (!recuento) throw new ApiError(404, "Recuento no encontrado");
  if (recuento.estado !== "FINALIZADO") throw new ApiError(400, "El recuento no está finalizado");

  const ocupada = await prisma.recuento.findFirst({
    where: { ubicacionId: recuento.ubicacionId, estado: "EN_PROGRESO" },
  });
  if (ocupada) {
    throw new ApiError(409, "La ubicación tiene otro recuento en curso; no se puede reabrir");
  }

  const actualizado = await prisma.recuento.update({
    where: { id },
    data: { estado: "EN_PROGRESO", finalizadoEn: null, firmaNombre: null, firmaNbi: null },
  });
  return NextResponse.json({ recuento: actualizado });
});
