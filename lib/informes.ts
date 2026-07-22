import { prisma } from "@/lib/prisma";

/** Fila plana del informe de recuento, lista para exportar al ERP. */
export interface FilaInforme {
  almacen: string;
  estancia: string;
  estanteria: string;
  ubicacion: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  operario: string;
  nbi: string;
  fecha: string;
  estadoRecuento: string;
  incidencia: string;
}

export const COLUMNAS_INFORME: { clave: keyof FilaInforme; titulo: string; ancho: number }[] = [
  { clave: "almacen", titulo: "Almacén", ancho: 22 },
  { clave: "estancia", titulo: "Estancia", ancho: 22 },
  { clave: "estanteria", titulo: "Estantería", ancho: 14 },
  { clave: "ubicacion", titulo: "Ubicación", ancho: 16 },
  { clave: "descripcion", titulo: "Descripción del artículo", ancho: 45 },
  { clave: "cantidad", titulo: "Cantidad", ancho: 12 },
  { clave: "unidad", titulo: "Unidad", ancho: 10 },
  { clave: "operario", titulo: "Operario", ancho: 22 },
  { clave: "nbi", titulo: "NBI", ancho: 10 },
  { clave: "fecha", titulo: "Fecha", ancho: 18 },
  { clave: "estadoRecuento", titulo: "Estado", ancho: 14 },
  { clave: "incidencia", titulo: "Incidencia", ancho: 14 },
];

/**
 * Obtiene las filas del informe. Ámbito: todo el almacén o una estantería.
 * Las incidencias resueltas ya aparecen integradas como líneas normales
 * (la resolución convierte la línea); las abiertas se marcan como tal.
 */
export async function obtenerFilasInforme(opciones: {
  almacenId?: string;
  estanteriaId?: string;
  soloFinalizados?: boolean;
}): Promise<FilaInforme[]> {
  const lineas = await prisma.lineaRecuento.findMany({
    where: {
      estado: "ACTIVA",
      recuento: {
        ...(opciones.soloFinalizados ? { estado: "FINALIZADO" } : {}),
        ubicacion: {
          ...(opciones.estanteriaId ? { estanteriaId: opciones.estanteriaId } : {}),
          ...(opciones.almacenId
            ? { estanteria: { estancia: { almacenId: opciones.almacenId } } }
            : {}),
        },
      },
    },
    include: {
      unidadMedida: true,
      incidencia: true,
      recuento: {
        include: {
          operario: { select: { nombre: true, nbi: true } },
          ubicacion: {
            include: { estanteria: { include: { estancia: { include: { almacen: true } } } } },
          },
        },
      },
    },
    orderBy: [{ recuento: { ubicacion: { codigo: "asc" } } }, { createdAt: "asc" }],
  });

  return lineas.map((l) => {
    const u = l.recuento.ubicacion;
    const fecha = l.recuento.finalizadoEn ?? l.recuento.iniciadoEn;
    return {
      almacen: u.estanteria.estancia.almacen.nombre,
      estancia: `${u.estanteria.estancia.codigo} · ${u.estanteria.estancia.nombre}`,
      estanteria: u.estanteria.codigo,
      ubicacion: u.codigo,
      descripcion: l.descripcionArticulo || "(sin descripción)",
      cantidad: Number(l.cantidad),
      unidad: l.unidadMedida?.codigo ?? "",
      operario: l.recuento.operario.nombre,
      nbi: l.recuento.operario.nbi,
      fecha: fecha.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      estadoRecuento: l.recuento.estado === "FINALIZADO" ? "Finalizado" : "En progreso",
      incidencia: l.incidencia
        ? l.incidencia.estado === "RESUELTA"
          ? "Resuelta"
          : "Abierta"
        : "",
    };
  });
}
