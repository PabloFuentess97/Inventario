import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";
import { reactivarRama } from "@/lib/estructura";

const schema = z.object({
  estanteriaId: z.string(),
  niveles: z.number().int().min(1).max(50),
  huecos: z.number().int().min(1).max(100),
  /**
   * Plantilla del código; admite {EST}, {N} y {H}.
   * Ej.: "{EST}-N{N}-H{H}" → E01-N1-H1
   * Ej.: "{N}{H}"          → 11, 12, 13, 14, 21, 22… (numeración de pasillo)
   */
  plantilla: z.string().min(1).max(100).default("{EST}-N{N}-H{H}"),
});

/**
 * Generación de ubicaciones en lote para una estantería:
 * crea niveles × huecos ubicaciones con códigos a partir de la plantilla.
 * Las que ya existan (mismo código) se omiten sin error.
 */
export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const datos = schema.parse(await peticion.json());

  const estanteria = await prisma.estanteria.findUnique({ where: { id: datos.estanteriaId } });
  if (!estanteria) throw new ApiError(404, "La estantería no existe");

  // Si la rama estaba archivada, se reactiva para que las ubicaciones generadas
  // lleguen de verdad al operario.
  await reactivarRama(datos.estanteriaId);

  const ubicaciones = [];
  for (let nivel = 1; nivel <= datos.niveles; nivel++) {
    for (let hueco = 1; hueco <= datos.huecos; hueco++) {
      ubicaciones.push({
        estanteriaId: datos.estanteriaId,
        codigo: datos.plantilla
          .replaceAll("{EST}", estanteria.codigo)
          .replaceAll("{N}", String(nivel))
          .replaceAll("{H}", String(hueco)),
        nivel,
        hueco,
      });
    }
  }

  const resultado = await prisma.ubicacion.createMany({
    data: ubicaciones,
    skipDuplicates: true,
  });

  return NextResponse.json({ creadas: resultado.count, total: ubicaciones.length });
});
