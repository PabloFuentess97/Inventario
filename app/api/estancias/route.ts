import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  almacenId: z.string(),
  codigo: z.string().min(1).max(50),
  nombre: z.string().min(1).max(200),
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());
  const estancia = await prisma.estancia.create({ data: datos });
  return NextResponse.json({ estancia }, { status: 201 });
});
