import { NextResponse } from "next/server";
import { z } from "zod";
import { conManejadorErrores, requireSesion } from "@/lib/api";
import { restaurarEstructura } from "@/lib/estructura";

const schema = z.object({
  tipo: z.enum(["almacen", "estancia", "estanteria", "ubicacion"]),
  id: z.string(),
});

/**
 * Restaura un elemento de estructura archivado (solo ADMIN): vuelve a estar
 * visible en la oficina y en el móvil de los operarios, con sus recuentos.
 */
export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["ADMIN"]);
  const { tipo, id } = schema.parse(await peticion.json());
  await restaurarEstructura(tipo, id);
  return NextResponse.json({ ok: true });
});
