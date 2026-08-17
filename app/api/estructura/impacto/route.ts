import { NextResponse } from "next/server";
import { z } from "zod";
import { conManejadorErrores, requireSesion } from "@/lib/api";
import { contarRecuentos, type TipoEstructura } from "@/lib/estructura";

const schema = z.object({
  tipo: z.enum(["almacen", "estancia", "estanteria", "ubicacion"]),
  id: z.string(),
});

/**
 * Cuántos recuentos dependen de un elemento de estructura y, por tanto, qué
 * pasará si se borra: se ARCHIVA (si hay datos) o se ELIMINA (si no hay).
 * Sirve para avisar con precisión antes de confirmar.
 */
export const GET = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["ADMIN"]);
  const params = new URL(peticion.url).searchParams;
  const { tipo, id } = schema.parse({ tipo: params.get("tipo"), id: params.get("id") });

  const recuentos = await contarRecuentos(tipo as TipoEstructura, id);
  return NextResponse.json({
    recuentos,
    accion: recuentos > 0 ? "archivado" : "eliminado",
  });
});
