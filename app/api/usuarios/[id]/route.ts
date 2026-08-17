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

/** Edición completa del usuario: nombre, NBI, email, contraseña, rol y estado. */
export const PATCH = conManejadorErrores(async (peticion: Request, { params }: Contexto) => {
  const sesion = await requireSesion(["ADMIN"]);
  const { id } = await params;
  const { password, ...resto } = schema.parse(await peticion.json());

  if (id === sesion.user.id && resto.activo === false) {
    throw new ApiError(400, "No puedes desactivar tu propio usuario");
  }
  if (id === sesion.user.id && resto.rol && resto.rol !== "ADMIN") {
    throw new ApiError(400, "No puedes quitarte a ti mismo el rol de administrador");
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

/**
 * Eliminación de un usuario (solo ADMIN).
 *
 * Si el usuario ya ha participado en recuentos o incidencias NO se borra: se
 * desactiva. Borrarlo destruiría la trazabilidad (quién contó y firmó cada
 * ubicación), que es justo lo que da valor al inventario. Si no tiene ningún
 * dato asociado, se elimina de verdad.
 */
export const DELETE = conManejadorErrores(async (_peticion: Request, { params }: Contexto) => {
  const sesion = await requireSesion(["ADMIN"]);
  const { id } = await params;

  if (id === sesion.user.id) {
    throw new ApiError(400, "No puedes eliminar tu propio usuario");
  }

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) throw new ApiError(404, "El usuario no existe");

  const [recuentos, abiertas, resueltas] = await Promise.all([
    prisma.recuento.count({ where: { operarioId: id } }),
    prisma.incidencia.count({ where: { abiertaPorId: id } }),
    prisma.incidencia.count({ where: { resueltaPorId: id } }),
  ]);
  const datos = recuentos + abiertas + resueltas;

  if (datos > 0) {
    // Conserva la trazabilidad: el usuario deja de poder entrar, pero su
    // nombre y NBI siguen figurando en los recuentos que firmó.
    await prisma.usuario.update({ where: { id }, data: { activo: false } });
    return NextResponse.json({ ok: true, accion: "desactivado", recuentos });
  }

  await prisma.usuario.delete({ where: { id } });
  return NextResponse.json({ ok: true, accion: "eliminado", recuentos: 0 });
});
