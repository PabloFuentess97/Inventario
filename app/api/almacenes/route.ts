import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const almacenSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(1000).optional().nullable(),
});

/**
 * Lista de almacenes con su árbol completo (para el panel de estructura).
 * Por defecto oculta lo archivado; con ?incluirArchivados=1 se muestra todo
 * (el administrador puede así restaurar lo que archivó).
 */
export const GET = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const incluirArchivados =
    new URL(peticion.url).searchParams.get("incluirArchivados") === "1";
  const soloActivos = incluirArchivados ? {} : { archivada: false };
  const almacenes = await prisma.almacen.findMany({
    where: soloActivos,
    orderBy: { nombre: "asc" },
    include: {
      pasillos: {
        where: soloActivos,
        orderBy: { codigo: "asc" },
        include: {
          estanterias: {
            where: soloActivos,
            orderBy: { codigo: "asc" },
            include: {
              ubicaciones: {
                where: soloActivos,
                orderBy: [{ nivel: "asc" }, { hueco: "asc" }, { codigo: "asc" }],
              },
              _count: { select: { ubicaciones: true } },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ almacenes });
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = almacenSchema.parse(await peticion.json());
  const almacen = await prisma.almacen.create({ data: datos });
  return NextResponse.json({ almacen }, { status: 201 });
});
