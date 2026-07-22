import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COLA_ACTIVA, getRedis } from "@/lib/queue/conexion";

/**
 * Sonda de salud para los healthchecks de Docker / balanceador.
 * Comprueba conectividad con Postgres y, si la cola está activa, con Redis.
 */
export async function GET() {
  const salud: Record<string, string> = { app: "ok" };
  let ok = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    salud.db = "ok";
  } catch {
    salud.db = "error";
    ok = false;
  }

  if (COLA_ACTIVA) {
    try {
      const pong = await getRedis().ping();
      salud.redis = pong === "PONG" ? "ok" : "error";
      if (pong !== "PONG") ok = false;
    } catch {
      salud.redis = "error";
      ok = false;
    }
  } else {
    salud.redis = "desactivado";
  }

  return NextResponse.json(salud, { status: ok ? 200 : 503 });
}
