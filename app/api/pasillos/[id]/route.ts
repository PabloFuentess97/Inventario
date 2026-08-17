import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";
import { borrarEstructura } from "@/lib/estructura";

const schema = z.object({
  codigo: z.string().min(1).max(50).optional(),
  nombre: z.string().min(1).max(200).optional(),
});

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { id } = await params;
  const datos = schema.parse(await peticion.json());
  const pasillo = await prisma.pasillo.update({ where: { id }, data: datos });
  return NextResponse.json({ pasillo });
});

/**
 * Borrado seguro (solo ADMIN):
 *  - sin recuentos → se elimina de verdad
 *  - con recuentos → se ARCHIVA: se oculta de la app y del móvil, pero los
 *    recuentos, fotos e informes se conservan intactos (reversible)
 */
export const DELETE = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  await requireSesion(["ADMIN"]);
  const { id } = await params;
  const resultado = await borrarEstructura("pasillo", id);
  return NextResponse.json({ ok: true, ...resultado });
});
