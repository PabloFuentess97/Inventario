import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  nombre: z.string().min(1).max(200).optional(),
  nbi: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  rol: z.enum(["OPERARIO", "OFICINISTA", "ADMIN"]).optional(),
  activo: z.boolean().optional(),
});

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await requireSesion(["ADMIN"]);
  const { id } = await params;
  const { password, ...resto } = schema.parse(await peticion.json());

  if (id === sesion.user.id && resto.activo === false) {
    throw new ApiError(400, "No puedes desactivar tu propio usuario");
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: {
      ...resto,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: { id: true, nombre: true, nbi: true, email: true, rol: true, activo: true },
  });
  return NextResponse.json({ usuario });
});
