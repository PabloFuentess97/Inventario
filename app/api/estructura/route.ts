import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conManejadorErrores, requireSesion } from "@/lib/api";

/**
 * Estructura completa del almacén, aplanada por ubicación, para que el
 * operario la precargue en IndexedDB y pueda navegarla SIN CONEXIÓN.
 * Incluye qué ubicaciones están ocupadas (recuento EN_PROGRESO) y el
 * catálogo de unidades de medida.
 */
export const GET = conManejadorErrores(async () => {
  await requireSesion();

  const [almacenes, unidades, recuentosActivos] = await Promise.all([
    // El operario solo ve estructura ACTIVA (lo archivado desaparece del móvil)
    prisma.almacen.findMany({
      where: { archivada: false },
      include: {
        estancias: {
          where: { archivada: false },
          orderBy: { codigo: "asc" },
          include: {
            estanterias: {
              where: { archivada: false },
              orderBy: { codigo: "asc" },
              include: {
                ubicaciones: {
                  where: { archivada: false },
                  orderBy: [{ nivel: "asc" }, { hueco: "asc" }, { codigo: "asc" }],
                },
              },
            },
          },
        },
      },
    }),
    prisma.unidadMedida.findMany({ where: { activa: true }, orderBy: { codigo: "asc" } }),
    prisma.recuento.findMany({ where: { estado: "EN_PROGRESO" }, select: { ubicacionId: true } }),
  ]);

  const ocupadas = new Set(recuentosActivos.map((r) => r.ubicacionId));

  const ubicaciones = almacenes.flatMap((almacen) =>
    almacen.estancias.flatMap((estancia) =>
      estancia.estanterias.flatMap((estanteria) =>
        estanteria.ubicaciones.map((u) => ({
          id: u.id,
          codigo: u.codigo,
          nivel: u.nivel,
          hueco: u.hueco,
          descripcion: u.descripcion,
          estanteriaId: estanteria.id,
          estanteriaCodigo: estanteria.codigo,
          estanciaId: estancia.id,
          estanciaCodigo: estancia.codigo,
          estanciaNombre: estancia.nombre,
          almacenId: almacen.id,
          almacenNombre: almacen.nombre,
          ocupada: ocupadas.has(u.id),
        }))
      )
    )
  );

  return NextResponse.json({
    ubicaciones,
    unidades: unidades.map((u) => ({ id: u.id, codigo: u.codigo, nombre: u.nombre })),
  });
});
