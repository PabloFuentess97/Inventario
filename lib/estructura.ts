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

export type TipoEstructura = "almacen" | "estancia" | "estanteria" | "ubicacion";

export interface ResultadoBorrado {
  accion: "archivado" | "eliminado";
  recuentos: number;
}

/** Cuenta los recuentos que dependen del elemento indicado. */
export async function contarRecuentos(tipo: TipoEstructura, id: string): Promise<number> {
  switch (tipo) {
    case "almacen":
      return prisma.recuento.count({
        where: { ubicacion: { estanteria: { estancia: { almacenId: id } } } },
      });
    case "estancia":
      return prisma.recuento.count({ where: { ubicacion: { estanteria: { estanciaId: id } } } });
    case "estanteria":
      return prisma.recuento.count({ where: { ubicacion: { estanteriaId: id } } });
    case "ubicacion":
      return prisma.recuento.count({ where: { ubicacionId: id } });
  }
}

/**
 * Archiva o elimina el elemento según si tiene recuentos.
 * Al archivar, se archiva también todo su contenido (en cascada lógica) para
 * que no queden estancias o ubicaciones "huérfanas" visibles en el móvil.
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
      case "estancia":
        await prisma.estancia.delete({ where: { id } });
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
        await tx.estancia.updateMany({ where: { almacenId: id }, data: { archivada: true } });
        await tx.estanteria.updateMany({
          where: { estancia: { almacenId: id } },
          data: { archivada: true },
        });
        await tx.ubicacion.updateMany({
          where: { estanteria: { estancia: { almacenId: id } } },
          data: { archivada: true },
        });
        break;
      }
      case "estancia": {
        await tx.estancia.update({ where: { id }, data: { archivada: true } });
        await tx.estanteria.updateMany({ where: { estanciaId: id }, data: { archivada: true } });
        await tx.ubicacion.updateMany({
          where: { estanteria: { estanciaId: id } },
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

/** Restaura un elemento archivado (y sus padres, para que vuelva a ser visible). */
export async function restaurarEstructura(tipo: TipoEstructura, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    switch (tipo) {
      case "almacen": {
        await tx.almacen.update({ where: { id }, data: { archivada: false } });
        await tx.estancia.updateMany({ where: { almacenId: id }, data: { archivada: false } });
        await tx.estanteria.updateMany({
          where: { estancia: { almacenId: id } },
          data: { archivada: false },
        });
        await tx.ubicacion.updateMany({
          where: { estanteria: { estancia: { almacenId: id } } },
          data: { archivada: false },
        });
        break;
      }
      case "estancia": {
        const estancia = await tx.estancia.update({
          where: { id },
          data: { archivada: false },
        });
        // El padre debe estar visible para que se vea la estancia
        await tx.almacen.update({ where: { id: estancia.almacenId }, data: { archivada: false } });
        await tx.estanteria.updateMany({ where: { estanciaId: id }, data: { archivada: false } });
        await tx.ubicacion.updateMany({
          where: { estanteria: { estanciaId: id } },
          data: { archivada: false },
        });
        break;
      }
      case "estanteria": {
        const estanteria = await tx.estanteria.update({
          where: { id },
          data: { archivada: false },
        });
        const estancia = await tx.estancia.update({
          where: { id: estanteria.estanciaId },
          data: { archivada: false },
        });
        await tx.almacen.update({ where: { id: estancia.almacenId }, data: { archivada: false } });
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
        const estancia = await tx.estancia.update({
          where: { id: estanteria.estanciaId },
          data: { archivada: false },
        });
        await tx.almacen.update({ where: { id: estancia.almacenId }, data: { archivada: false } });
        break;
      }
    }
  });
}
