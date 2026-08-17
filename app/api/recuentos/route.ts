import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

/**
 * Listado de recuentos para la oficina, con paginación y filtros.
 * Query: ?estado=EN_PROGRESO|FINALIZADO&pagina=1&porPagina=25&buscar=texto
 */
export const GET = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);

  const url = new URL(peticion.url);
  const estado = url.searchParams.get("estado");
  const buscar = url.searchParams.get("buscar")?.trim();
  const pagina = Math.max(1, parseInt(url.searchParams.get("pagina") ?? "1", 10) || 1);
  const porPagina = Math.min(100, parseInt(url.searchParams.get("porPagina") ?? "25", 10) || 25);

  const incluirArchivados = url.searchParams.get("incluirArchivados") === "1";

  const where: Prisma.RecuentoWhereInput = {
    ...(incluirArchivados ? {} : { archivado: false }),
    ...(estado === "EN_PROGRESO" || estado === "FINALIZADO" ? { estado } : {}),
    ...(buscar
      ? {
          OR: [
            { ubicacion: { codigo: { contains: buscar, mode: "insensitive" } } },
            { operario: { nombre: { contains: buscar, mode: "insensitive" } } },
            { operario: { nbi: { contains: buscar, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, recuentos] = await Promise.all([
    prisma.recuento.count({ where }),
    prisma.recuento.findMany({
      where,
      orderBy: { iniciadoEn: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: {
        operario: { select: { nombre: true, nbi: true } },
        ubicacion: {
          include: { estanteria: { include: { pasillo: { include: { almacen: true } } } } },
        },
        _count: { select: { lineas: { where: { estado: "ACTIVA" } } } },
      },
    }),
  ]);

  return NextResponse.json({ total, pagina, porPagina, recuentos });
});
