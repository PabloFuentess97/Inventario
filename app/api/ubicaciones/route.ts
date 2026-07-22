import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  estanteriaId: z.string(),
  codigo: z.string().min(1).max(50),
  nivel: z.number().int().min(0).optional().nullable(),
  hueco: z.number().int().min(0).optional().nullable(),
  descripcion: z.string().max(500).optional().nullable(),
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());
  const ubicacion = await prisma.ubicacion.create({ data: datos });
  return NextResponse.json({ ubicacion }, { status: 201 });
});
