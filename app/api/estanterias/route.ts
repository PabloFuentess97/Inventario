import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  estanciaId: z.string(),
  codigo: z.string().min(1).max(50),
  descripcion: z.string().max(500).optional().nullable(),
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());
  const estanteria = await prisma.estanteria.create({ data: datos });
  return NextResponse.json({ estanteria }, { status: 201 });
});
