import { NextResponse } from "next/server";
import { conManejadorErrores, requireSesion } from "@/lib/api";

/** Datos del usuario en sesión, para que la interfaz adapte lo que muestra. */
export const GET = conManejadorErrores(async () => {
  const sesion = await requireSesion();
  return NextResponse.json({
    id: sesion.user.id,
    nombre: sesion.user.nombre,
    nbi: sesion.user.nbi,
    rol: sesion.user.rol,
  });
});
