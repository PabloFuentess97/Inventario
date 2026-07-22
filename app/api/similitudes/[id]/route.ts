import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.discriminatedUnion("accion", [
  z.object({
    /** Es el mismo artículo con nombres distintos: se unifican las descripciones. */
    accion: z.literal("unificar"),
    descripcionCanonica: z.string().min(1).max(2000),
  }),
  z.object({
    /** Son artículos diferentes: el grupo se descarta y no se vuelve a proponer. */
    accion: z.literal("separar"),
  }),
]);

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());

  const grupo = await prisma.grupoSimilitud.findUnique({
    where: { id },
    include: { lineas: true },
  });
  if (!grupo) throw new ApiError(404, "Grupo no encontrado");
  if (grupo.estado !== "PENDIENTE") throw new ApiError(400, "El grupo ya está decidido");

  if (datos.accion === "unificar") {
    const ahora = new Date();
    await prisma.$transaction([
      prisma.lineaRecuento.updateMany({
        where: { id: { in: grupo.lineas.map((l) => l.lineaId) } },
        data: { descripcionArticulo: datos.descripcionCanonica, updatedAt: ahora },
      }),
      prisma.grupoSimilitud.update({
        where: { id },
        data: { estado: "UNIFICADO", descripcionCanonica: datos.descripcionCanonica },
      }),
    ]);
  } else {
    await prisma.grupoSimilitud.update({ where: { id }, data: { estado: "SEPARADO" } });
  }

  const actualizado = await prisma.grupoSimilitud.findUnique({ where: { id } });
  return NextResponse.json({ grupo: actualizado });
});
