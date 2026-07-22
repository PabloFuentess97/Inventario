import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

const schema = z.object({
  nombre: z.string().min(1).max(200),
  nbi: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  rol: z.enum(["OPERARIO", "OFICINISTA", "ADMIN"]),
});

export const GET = conManejadorErrores(async () => {
  await requireSesion(["ADMIN"]);
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, nbi: true, email: true, rol: true, activo: true, createdAt: true },
  });
  return NextResponse.json({ usuarios });
});

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["ADMIN"]);
  const datos = schema.parse(await peticion.json());
  const passwordHash = await bcrypt.hash(datos.password, 10);
  const usuario = await prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      nbi: datos.nbi,
      email: datos.email,
      passwordHash,
      rol: datos.rol,
    },
    select: { id: true, nombre: true, nbi: true, email: true, rol: true, activo: true },
  });
  return NextResponse.json({ usuario }, { status: 201 });
});
