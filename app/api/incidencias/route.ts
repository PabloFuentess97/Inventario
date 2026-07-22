import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

/** Panel de incidencias para oficina. Query: ?estado=ABIERTA|RESUELTA */
export const GET = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);

  const url = new URL(peticion.url);
  const estado = url.searchParams.get("estado");

  const incidencias = await prisma.incidencia.findMany({
    where: estado === "ABIERTA" || estado === "RESUELTA" ? { estado } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      abiertaPor: { select: { nombre: true, nbi: true } },
      resueltaPor: { select: { nombre: true } },
      linea: {
        include: {
          unidadMedida: true,
          recuento: {
            include: {
              ubicacion: {
                include: { estanteria: { include: { estancia: { include: { almacen: true } } } } },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ incidencias });
});
