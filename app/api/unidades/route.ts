import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  codigo: z.string().min(1).max(20).transform((c) => c.toUpperCase()),
  nombre: z.string().min(1).max(100),
});

export const GET = conManejadorErrores(async () => {
  await requireSesion();
  const unidades = await prisma.unidadMedida.findMany({ orderBy: { codigo: "asc" } });
  return NextResponse.json({ unidades });
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());
  const unidad = await prisma.unidadMedida.create({ data: datos });
  return NextResponse.json({ unidad }, { status: 201 });
});
