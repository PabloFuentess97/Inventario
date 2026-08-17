import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

/** Resumen para el panel de oficina (se consulta con polling ligero). */
export const GET = conManejadorErrores(async () => {
  await requireSesion(["OFICINISTA", "ADMIN"]);

  const [enProgreso, finalizados, incidenciasAbiertas, gruposPendientes, ubicaciones, ubicacionesContadas] =
    await Promise.all([
      prisma.recuento.count({ where: { estado: "EN_PROGRESO", archivado: false } }),
      prisma.recuento.count({ where: { estado: "FINALIZADO", archivado: false } }),
      prisma.incidencia.count({ where: { estado: "ABIERTA", archivada: false } }),
      prisma.grupoSimilitud.count({ where: { estado: "PENDIENTE" } }),
      prisma.ubicacion.count(),
      prisma.recuento
        .groupBy({ by: ["ubicacionId"], where: { estado: "FINALIZADO", archivado: false } })
        .then((g) => g.length),
    ]);

  const activos = await prisma.recuento.findMany({
    where: { estado: "EN_PROGRESO", archivado: false },
    orderBy: { iniciadoEn: "desc" },
    take: 20,
    include: {
      operario: { select: { nombre: true, nbi: true } },
      ubicacion: { include: { estanteria: { include: { pasillo: true } } } },
      _count: { select: { lineas: { where: { estado: "ACTIVA" } } } },
    },
  });

  return NextResponse.json({
    enProgreso,
    finalizados,
    incidenciasAbiertas,
    gruposPendientes,
    ubicaciones,
    ubicacionesContadas,
    activos,
  });
});
