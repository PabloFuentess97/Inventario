import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  /** Qué es realmente el artículo: pasa a ser la descripción de la línea. */
  descripcion: z.string().min(1).max(2000),
  /** Nota opcional de la resolución. */
  notaResolucion: z.string().max(4000).optional(),
});

type Contexto = { params: Promise<{ id: string }> };

/**
 * Resolución de una incidencia por la oficina.
 *
 * La incidencia ya lleva ligada su línea con ubicación, CANTIDAD y UNIDAD
 * contadas por el operario, así que al indicar qué es el artículo la línea
 * se convierte automáticamente en una línea de recuento normal: cuadre
 * directo, sin volver a contar.
 */
export const POST = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());

  const incidencia = await prisma.incidencia.findUnique({ where: { id } });
  if (!incidencia) throw new ApiError(404, "Incidencia no encontrada");
  if (incidencia.estado === "RESUELTA") throw new ApiError(400, "La incidencia ya está resuelta");

  const ahora = new Date();
  const [incidenciaResuelta] = await prisma.$transaction([
    prisma.incidencia.update({
      where: { id },
      data: {
        estado: "RESUELTA",
        resueltaPorId: sesion.user.id,
        descripcionResolucion: datos.notaResolucion
          ? `${datos.descripcion} — ${datos.notaResolucion}`
          : datos.descripcion,
        resueltaEn: ahora,
        updatedAt: ahora,
      },
    }),
    // La línea deja de ser incidencia y queda identificada: recuento normal
    prisma.lineaRecuento.update({
      where: { id: incidencia.lineaRecuentoId },
      data: {
        descripcionArticulo: datos.descripcion,
        esIncidencia: false,
        updatedAt: ahora,
      },
    }),
  ]);

  return NextResponse.json({ incidencia: incidenciaResuelta });
});
