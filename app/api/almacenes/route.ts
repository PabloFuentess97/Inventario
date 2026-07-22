import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const almacenSchema = z.object({
  nombre: z.string().min(1).max(200),
  descripcion: z.string().max(1000).optional().nullable(),
});

/** Lista de almacenes con su árbol completo (para el panel de estructura). */
export const GET = conManejadorErrores(async () => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const almacenes = await prisma.almacen.findMany({
    orderBy: { nombre: "asc" },
    include: {
      estancias: {
        orderBy: { codigo: "asc" },
        include: {
          estanterias: {
            orderBy: { codigo: "asc" },
            include: {
              ubicaciones: { orderBy: [{ nivel: "asc" }, { hueco: "asc" }, { codigo: "asc" }] },
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
