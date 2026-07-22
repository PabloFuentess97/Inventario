import { NextResponse } from "next/server";
import type { Rol } from "@prisma/client";
import { ZodError } from "zod";
import { auth } from "@/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string
  ) {
    super(message);
  }
}

/**
 * Exige sesión y (opcionalmente) uno de los roles indicados.
 * Lanza ApiError 401/403 si no se cumple.
 */
export async function requireSesion(roles?: Rol[]) {
  const sesion = await auth();
  if (!sesion?.user) {
    throw new ApiError(401, "No autenticado");
  }
  if (roles && !roles.includes(sesion.user.rol)) {
    throw new ApiError(403, "No tienes permiso para realizar esta acción");
  }
  return sesion;
}

/** Envuelve un handler y convierte errores en respuestas JSON coherentes. */
export function conManejadorErrores<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, codigo: error.codigo },
          { status: error.status }
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Datos no válidos", detalles: error.flatten() },
          { status: 400 }
        );
      }
      console.error("Error no controlado en API:", error);
      return NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      );
    }
  };
}
