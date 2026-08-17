import { prisma } from "@/lib/prisma";

/**
 * Borrado seguro de la estructura del almacén (solo ADMIN).
 *
 * Regla de oro: NUNCA se pierden datos de recuento.
 *  - Si el elemento (o algo dentro de él) tiene recuentos registrados, se
 *    ARCHIVA (borrado lógico): desaparece de la app y del móvil, pero los
 *    recuentos, líneas, fotos e informes se conservan intactos y se pueden
 *    seguir exportando. Es reversible (restaurar).
 *  - Si no tiene ningún recuento, se ELIMINA físicamente (limpieza real).
 *
 * Devuelve qué se hizo para poder informar al usuario con precisión.
 */

export type TipoEstructura = "almacen" | "pasillo" | "estanteria" | "ubicacion";

export interface ResultadoBorrado {
  accion: "archivado" | "eliminado";
  recuentos: number;
}

/** Cuenta los recuentos que dependen del elemento indicado. */
export async function contarRecuentos(tipo: TipoEstructura, id: string): Promise<number> {
  switch (tipo) {
    case "almacen":
      return prisma.recuento.count({
        where: { ubicacion: { estanteria: { pasillo: { almacenId: id } } } },
      });
    case "pasillo":
      return prisma.recuento.count({ where: { ubicacion: { estanteria: { pasilloId: id } } } });
    case "estanteria":
      return prisma.recuento.count({ where: { ubicacion: { estanteriaId: id } } });
    case "ubicacion":
      return prisma.recuento.count({ where: { ubicacionId: id } });
  }
}

/**
 * Archiva o elimina el elemento según si tiene recuentos.
 * Al archivar, se archiva también todo su contenido (en cascada lógica) para
 * que no queden pasillos o ubicaciones "huérfanas" visibles en el móvil.
 */
export async function borrarEstructura(
  tipo: TipoEstructura,
  id: string
): Promise<ResultadoBorrado> {
  const recuentos = await contarRecuentos(tipo, id);

  if (recuentos === 0) {
    // Sin datos asociados: borrado físico (las relaciones son onDelete: Cascade)
    switch (tipo) {
      case "almacen":
        await prisma.almacen.delete({ where: { id } });
        break;
      case "pasillo":
        await prisma.pasillo.delete({ where: { id } });
        break;
      case "estanteria":
        await prisma.estanteria.delete({ where: { id } });
        break;
      case "ubicacion":
        await prisma.ubicacion.delete({ where: { id } });
        break;
    }
    return { accion: "eliminado", recuentos: 0 };
  }

  // Con datos: archivado en cascada, sin borrar nada
  await prisma.$transaction(async (tx) => {
    switch (tipo) {
      case "almacen": {
        await tx.almacen.update({ where: { id }, data: { archivada: true } });
        await tx.pasillo.updateMany({ where: { almacenId: id }, data: { archivada: true } });
        await tx.estanteria.updateMany({
          where: { pasillo: { almacenId: id } },
          data: { archivada: true },
        });
        await tx.ubicacion.updateMany({
          where: { estanteria: { pasillo: { almacenId: id } } },
          data: { archivada: true },
        });
        break;
      }
      case "pasillo": {
        await tx.pasillo.update({ where: { id }, data: { archivada: true } });
        await tx.estanteria.updateMany({ where: { pasilloId: id }, data: { archivada: true } });
        await tx.ubicacion.updateMany({
          where: { estanteria: { pasilloId: id } },
          data: { archivada: true },
        });
        break;
      }
      case "estanteria": {
        await tx.estanteria.update({ where: { id }, data: { archivada: true } });
        await tx.ubicacion.updateMany({ where: { estanteriaId: id }, data: { archivada: true } });
        break;
      }
      case "ubicacion": {
        await tx.ubicacion.update({ where: { id }, data: { archivada: true } });
        break;
      }
    }
  });

  return { accion: "archivado", recuentos };
}

/**
 * Reactiva (desarchiva) la rama a la que pertenece una estantería: la propia
 * estantería, su pasillo y su almacén.
 *
 * Se usa al crear ubicaciones: si la rama estuviera archivada, la ubicación
 * nueva no aparecería ni en la oficina ni en el móvil del operario, porque el
 * filtro excluye toda la rama archivada aunque el elemento nuevo no lo esté.
 */
export async function reactivarRama(estanteriaId: string): Promise<void> {
  const estanteria = await prisma.estanteria.findUnique({
    where: { id: estanteriaId },
    include: { pasillo: true },
  });
  if (!estanteria) return;
  if (!estanteria.archivada && !estanteria.pasillo.archivada) {
    // Ya está visible; se comprueba el almacén por si acaso
    const almacen = await prisma.almacen.findUnique({
      where: { id: estanteria.pasillo.almacenId },
      select: { archivada: true },
    });
    if (!almacen?.archivada) return;
  }

  await prisma.$transaction([
    prisma.estanteria.update({ where: { id: estanteriaId }, data: { archivada: false } }),
    prisma.pasillo.update({ where: { id: estanteria.pasilloId }, data: { archivada: false } }),
    prisma.almacen.update({
      where: { id: estanteria.pasillo.almacenId },
      data: { archivada: false },
    }),
  ]);
}

/** Restaura un elemento archivado (y sus padres, para que vuelva a ser visible). */
export async function restaurarEstructura(tipo: TipoEstructura, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    switch (tipo) {
      case "almacen": {
        await tx.almacen.update({ where: { id }, data: { archivada: false } });
        await tx.pasillo.updateMany({ where: { almacenId: id }, data: { archivada: false } });
        await tx.estanteria.updateMany({
          where: { pasillo: { almacenId: id } },
          data: { archivada: false },
        });
        await tx.ubicacion.updateMany({
          where: { estanteria: { pasillo: { almacenId: id } } },
          data: { archivada: false },
        });
        break;
      }
      case "pasillo": {
        const pasillo = await tx.pasillo.update({
          where: { id },
          data: { archivada: false },
        });
        // El padre debe estar visible para que se vea el pasillo
        await tx.almacen.update({ where: { id: pasillo.almacenId }, data: { archivada: false } });
        await tx.estanteria.updateMany({ where: { pasilloId: id }, data: { archivada: false } });
        await tx.ubicacion.updateMany({
          where: { estanteria: { pasilloId: id } },
          data: { archivada: false },
        });
        break;
      }
      case "estanteria": {
        const estanteria = await tx.estanteria.update({
          where: { id },
          data: { archivada: false },
        });
        const pasillo = await tx.pasillo.update({
          where: { id: estanteria.pasilloId },
          data: { archivada: false },
        });
        await tx.almacen.update({ where: { id: pasillo.almacenId }, data: { archivada: false } });
        await tx.ubicacion.updateMany({ where: { estanteriaId: id }, data: { archivada: false } });
        break;
      }
      case "ubicacion": {
        const ubicacion = await tx.ubicacion.update({
          where: { id },
          data: { archivada: false },
        });
        const estanteria = await tx.estanteria.update({
          where: { id: ubicacion.estanteriaId },
          data: { archivada: false },
        });
        const pasillo = await tx.pasillo.update({
          where: { id: estanteria.pasilloId },
          data: { archivada: false },
        });
        await tx.almacen.update({ where: { id: pasillo.almacenId }, data: { archivada: false } });
        break;
      }
    }
  });
}
