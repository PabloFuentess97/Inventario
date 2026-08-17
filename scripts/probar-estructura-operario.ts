/**
 * Pruebas de lo que ve el operario en su móvil:
 *
 *  1. Al crear estructura dentro de una rama ARCHIVADA, la rama se reactiva y
 *     la ubicación nueva llega al operario (si no, quedaría invisible: es el
 *     fallo de "archivo la antigua, creo otra y no me aparece").
 *  2. La unidad de medida por defecto se entrega al móvil para asignarla sola.
 *
 * Uso: npx tsx scripts/probar-estructura-operario.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { borrarEstructura, reactivarRama } from "../lib/estructura";

const MARCA = "[PRUEBA-ESTRUCTURA]";

function comprobar(condicion: boolean, mensaje: string) {
  console.log(`${condicion ? "✓" : "✗"} ${mensaje}`);
  if (!condicion) process.exitCode = 1;
}

/** Lo que /api/estructura envía al móvil del operario. */
async function ubicacionesVisiblesParaOperario(): Promise<string[]> {
  const almacenes = await prisma.almacen.findMany({
    where: { archivada: false },
    include: {
      pasillos: {
        where: { archivada: false },
        include: {
          estanterias: {
            where: { archivada: false },
            include: { ubicaciones: { where: { archivada: false } } },
          },
        },
      },
    },
  });
  return almacenes.flatMap((a) =>
    a.pasillos.flatMap((p) => p.estanterias.flatMap((e) => e.ubicaciones.map((u) => u.codigo)))
  );
}

async function main() {
  const operario = await prisma.usuario.findFirst({ where: { rol: "OPERARIO" } });
  if (!operario) throw new Error("Ejecuta antes el seed");

  // Almacén General > D > 11 (arquitectura real: almacén > pasillo > estantería)
  const almacen = await prisma.almacen.create({
    data: {
      nombre: `${MARCA} Almacén General`,
      pasillos: {
        create: {
          codigo: "D",
          nombre: "Pasillo D",
          estanterias: { create: { codigo: "11", ubicaciones: { create: { codigo: "D-11-01" } } } },
        },
      },
    },
    include: { pasillos: { include: { estanterias: { include: { ubicaciones: true } } } } },
  });
  const pasillo = almacen.pasillos[0];
  const estanteria = pasillo.estanterias[0];
  const ubicacionVieja = estanteria.ubicaciones[0];

  comprobar(
    (await ubicacionesVisiblesParaOperario()).includes("D-11-01"),
    "El operario ve la ubicación recién creada"
  );

  // Se cuenta algo en ella para que al archivar se archive (no se elimine)
  await prisma.recuento.create({
    data: {
      id: randomUUID(),
      ubicacionId: ubicacionVieja.id,
      operarioId: operario.id,
      estado: "FINALIZADO",
      finalizadoEn: new Date(),
      firmaNombre: MARCA,
      firmaNbi: "TEST",
    },
  });

  // ── El caso reportado: archivar la vieja y crear otra en la misma rama ──
  await borrarEstructura("ubicacion", ubicacionVieja.id);
  comprobar(
    !(await ubicacionesVisiblesParaOperario()).includes("D-11-01"),
    "Tras archivarla, el operario ya no ve la ubicación vieja"
  );

  // Se archiva ahora la estantería entera (deja la rama archivada)
  await borrarEstructura("estanteria", estanteria.id);
  const estanteriaArchivada = await prisma.estanteria.findUnique({ where: { id: estanteria.id } });
  comprobar(estanteriaArchivada?.archivada === true, "La estantería queda archivada");

  // Y se crea una ubicación nueva DENTRO de esa rama archivada
  await reactivarRama(estanteria.id);
  await prisma.ubicacion.create({ data: { estanteriaId: estanteria.id, codigo: "D-11-02" } });

  const visibles = await ubicacionesVisiblesParaOperario();
  comprobar(
    visibles.includes("D-11-02"),
    "La ubicación NUEVA creada en una rama archivada SÍ llega al operario"
  );
  comprobar(
    !visibles.includes("D-11-01"),
    "La ubicación archivada sigue oculta (no reaparece por reactivar la rama)"
  );

  // ── Unidad por defecto ──
  const unidades = await prisma.unidadMedida.findMany({ where: { activa: true } });
  const porDefecto = unidades.filter((u) => u.porDefecto);
  comprobar(porDefecto.length === 1, "Hay exactamente una unidad marcada por defecto");
  comprobar(porDefecto[0]?.codigo === "UD", `La unidad por defecto es Unidades (UD)`);

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
