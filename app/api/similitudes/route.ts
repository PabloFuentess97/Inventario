import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";
import { generarGruposSimilitud } from "@/lib/similitud";

/** Lista de grupos de similitud. Query: ?estado=PENDIENTE|UNIFICADO|SEPARADO */
export const GET = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const url = new URL(peticion.url);
  const estado = url.searchParams.get("estado");

  const grupos = await prisma.grupoSimilitud.findMany({
    where:
      estado === "PENDIENTE" || estado === "UNIFICADO" || estado === "SEPARADO"
        ? { estado }
        : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      lineas: {
        include: {
          linea: {
            include: {
              unidadMedida: true,
              recuento: {
                include: {
                  ubicacion: { include: { estanteria: { include: { estancia: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ grupos });
});

const generarSchema = z.object({
  umbral: z.number().min(0.1).max(0.95).optional(),
});

/** Regenera las agrupaciones sugeridas analizando las descripciones. */
export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const cuerpo = await peticion.json().catch(() => ({}));
  const { umbral } = generarSchema.parse(cuerpo ?? {});
  const creados = await generarGruposSimilitud(umbral);
  return NextResponse.json({ creados });
});
