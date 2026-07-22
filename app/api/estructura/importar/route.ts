import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

/**
 * Importación de estructura por CSV.
 *
 * Formato esperado (separador ; o ,), con cabecera:
 *   almacen;estancia_codigo;estancia_nombre;estanteria;ubicacion;nivel;hueco
 *
 * Crea lo que falte en cada nivel de la jerarquía; lo existente se reutiliza.
 */
const cuerpoSchema = z.object({ csv: z.string().min(1).max(5_000_000) });

export const POST = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);
  const { csv } = cuerpoSchema.parse(await peticion.json());

  const lineas = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length < 2) throw new ApiError(400, "El CSV no tiene filas de datos");

  const separador = lineas[0].includes(";") ? ";" : ",";
  const cabecera = lineas[0].split(separador).map((c) => c.trim().toLowerCase());
  const columnas = ["almacen", "estancia_codigo", "estancia_nombre", "estanteria", "ubicacion"];
  for (const col of columnas) {
    if (!cabecera.includes(col)) {
      throw new ApiError(400, `Falta la columna obligatoria "${col}" en la cabecera del CSV`);
    }
  }
  const idx = (nombre: string) => cabecera.indexOf(nombre);

  let creadas = 0;
  const errores: string[] = [];

  // Cachés para no repetir consultas por fila
  const cacheAlmacen = new Map<string, string>();
  const cacheEstancia = new Map<string, string>();
  const cacheEstanteria = new Map<string, string>();

  for (let i = 1; i < lineas.length; i++) {
    const campos = lineas[i].split(separador).map((c) => c.trim());
    try {
      const nombreAlmacen = campos[idx("almacen")];
      const codigoEstancia = campos[idx("estancia_codigo")];
      const nombreEstancia = campos[idx("estancia_nombre")] || codigoEstancia;
      const codigoEstanteria = campos[idx("estanteria")];
      const codigoUbicacion = campos[idx("ubicacion")];
      const nivel = idx("nivel") >= 0 && campos[idx("nivel")] ? parseInt(campos[idx("nivel")], 10) : null;
      const hueco = idx("hueco") >= 0 && campos[idx("hueco")] ? parseInt(campos[idx("hueco")], 10) : null;

      if (!nombreAlmacen || !codigoEstancia || !codigoEstanteria || !codigoUbicacion) {
        errores.push(`Fila ${i + 1}: faltan datos obligatorios`);
        continue;
      }

      let almacenId = cacheAlmacen.get(nombreAlmacen);
      if (!almacenId) {
        const almacen =
          (await prisma.almacen.findFirst({ where: { nombre: nombreAlmacen } })) ??
          (await prisma.almacen.create({ data: { nombre: nombreAlmacen } }));
        almacenId = almacen.id;
        cacheAlmacen.set(nombreAlmacen, almacenId);
      }

      const claveEstancia = `${almacenId}|${codigoEstancia}`;
      let estanciaId = cacheEstancia.get(claveEstancia);
      if (!estanciaId) {
        const estancia = await prisma.estancia.upsert({
          where: { almacenId_codigo: { almacenId, codigo: codigoEstancia } },
          update: {},
          create: { almacenId, codigo: codigoEstancia, nombre: nombreEstancia },
        });
        estanciaId = estancia.id;
        cacheEstancia.set(claveEstancia, estanciaId);
      }

      const claveEstanteria = `${estanciaId}|${codigoEstanteria}`;
      let estanteriaId = cacheEstanteria.get(claveEstanteria);
      if (!estanteriaId) {
        const estanteria = await prisma.estanteria.upsert({
          where: { estanciaId_codigo: { estanciaId, codigo: codigoEstanteria } },
          update: {},
          create: { estanciaId, codigo: codigoEstanteria },
        });
        estanteriaId = estanteria.id;
        cacheEstanteria.set(claveEstanteria, estanteriaId);
      }

      await prisma.ubicacion.upsert({
        where: { estanteriaId_codigo: { estanteriaId, codigo: codigoUbicacion } },
        update: { nivel, hueco },
        create: { estanteriaId, codigo: codigoUbicacion, nivel, hueco },
      });
      creadas++;
    } catch {
      errores.push(`Fila ${i + 1}: no se pudo importar`);
    }
  }

  return NextResponse.json({ procesadas: creadas, errores });
});
