/**
 * Prueba del borrado seguro de estructura (archivado vs eliminación).
 *
 * Verifica lo importante: que archivar un pasillo CON recuentos no pierde
 * ningún dato (recuentos, líneas, fotos siguen ahí y el informe los exporta),
 * que desaparece de lo que ve el operario, y que restaurar la devuelve.
 *
 * Uso: npx tsx scripts/probar-archivado.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { borrarEstructura, contarRecuentos, restaurarEstructura } from "../lib/estructura";
import { obtenerFilasInforme } from "../lib/informes";

const MARCA = "[PRUEBA-ARCHIVADO]";

function comprobar(condicion: boolean, mensaje: string) {
  console.log(`${condicion ? "✓" : "✗"} ${mensaje}`);
  if (!condicion) process.exitCode = 1;
}

async function main() {
  const operario = await prisma.usuario.findFirst({ where: { rol: "OPERARIO" } });
  if (!operario) throw new Error("Ejecuta antes el seed");

  // ── Estructura de prueba con datos ──
  const almacen = await prisma.almacen.create({
    data: {
      nombre: `${MARCA} Almacén`,
      pasillos: {
        create: {
          codigo: "PZ1",
          nombre: "Zona de prueba",
          estanterias: {
            create: { codigo: "PE1", ubicaciones: { create: { codigo: "PE1-N1-H1" } } },
          },
        },
      },
    },
    include: { pasillos: { include: { estanterias: { include: { ubicaciones: true } } } } },
  });
  const pasillo = almacen.pasillos[0];
  const estanteria = pasillo.estanterias[0];
  const ubicacion = estanteria.ubicaciones[0];

  // Recuento finalizado con una línea y una "foto"
  const recuentoId = randomUUID();
  await prisma.recuento.create({
    data: {
      id: recuentoId,
      ubicacionId: ubicacion.id,
      operarioId: operario.id,
      estado: "FINALIZADO",
      finalizadoEn: new Date(),
      firmaNombre: MARCA,
      firmaNbi: "TEST",
      lineas: {
        create: {
          id: randomUUID(),
          descripcionArticulo: `${MARCA} Artículo contado`,
          cantidad: 7,
          fotoEtiquetaUrl: "/api/archivos/2026-07/prueba.jpg",
        },
      },
    },
  });

  comprobar((await contarRecuentos("pasillo", pasillo.id)) === 1, "El pasillo tiene 1 recuento");

  // ── Con datos → debe ARCHIVAR, no borrar ──
  const r1 = await borrarEstructura("pasillo", pasillo.id);
  comprobar(r1.accion === "archivado", "Con recuentos: se archiva (no se elimina)");

  const trasArchivar = await prisma.recuento.findUnique({
    where: { id: recuentoId },
    include: { lineas: true },
  });
  comprobar(trasArchivar !== null, "El recuento SIGUE existiendo tras archivar");
  comprobar(trasArchivar?.lineas.length === 1, "La línea contada SIGUE existiendo");
  comprobar(
    trasArchivar?.lineas[0]?.fotoEtiquetaUrl === "/api/archivos/2026-07/prueba.jpg",
    "La foto de la línea SIGUE asociada"
  );

  // Archivado en cascada: estantería y ubicación también
  const estanteriaBd = await prisma.estanteria.findUnique({ where: { id: estanteria.id } });
  const ubicacionBd = await prisma.ubicacion.findUnique({ where: { id: ubicacion.id } });
  comprobar(estanteriaBd?.archivada === true, "La estantería queda archivada (cascada)");
  comprobar(ubicacionBd?.archivada === true, "La ubicación queda archivada (cascada)");

  // El operario ya no la ve
  const visiblesOperario = await prisma.ubicacion.count({
    where: { id: ubicacion.id, archivada: false },
  });
  comprobar(visiblesOperario === 0, "El operario ya NO ve la ubicación archivada");

  // El informe sigue exportando sus datos
  const filas = await obtenerFilasInforme({ almacenId: almacen.id });
  comprobar(
    filas.some((f) => f.descripcion.includes(MARCA) && f.cantidad === 7),
    "El informe SIGUE exportando el recuento archivado"
  );

  // ── Restaurar ──
  await restaurarEstructura("pasillo", pasillo.id);
  const restaurada = await prisma.ubicacion.findUnique({ where: { id: ubicacion.id } });
  comprobar(restaurada?.archivada === false, "Restaurar devuelve la ubicación a los operarios");

  // ── Sin datos → debe ELIMINAR de verdad ──
  const vacia = await prisma.pasillo.create({
    data: { almacenId: almacen.id, codigo: "PZ2", nombre: "Zona vacía" },
  });
  const r2 = await borrarEstructura("pasillo", vacia.id);
  comprobar(r2.accion === "eliminado", "Sin recuentos: se elimina de verdad");
  comprobar(
    (await prisma.pasillo.findUnique({ where: { id: vacia.id } })) === null,
    "El pasillo vacío ya no está en la base de datos"
  );

  // ── Limpieza ──
  await prisma.recuento.deleteMany({ where: { firmaNombre: MARCA } });
  await prisma.almacen.delete({ where: { id: almacen.id } });
  console.log("\nDatos de prueba eliminados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
