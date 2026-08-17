/**
 * Prueba del orden de aplicación de la sincronización.
 *
 * Regresión que cubre: si las operaciones se aplicaran en PARALELO, una línea
 * podría intentar aplicarse antes de que exista su recuento; el servidor la
 * rechazaría de forma definitiva y el cliente la descartaría → línea perdida.
 * Aquí se comprueba que aplicando el lote EN ORDEN (como hace /api/sync) todo
 * se guarda correctamente, incluso enviando el lote completo de una vez.
 *
 * Uso: npx tsx scripts/probar-sync-orden.ts
 */
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { procesarOperacion } from "../lib/sync-core";

const MARCA = "[PRUEBA-SYNC]";

function comprobar(condicion: boolean, mensaje: string) {
  console.log(`${condicion ? "✓" : "✗"} ${mensaje}`);
  if (!condicion) process.exitCode = 1;
}

async function main() {
  const operario = await prisma.usuario.findFirst({ where: { rol: "OPERARIO" } });
  const unidad = await prisma.unidadMedida.findFirst();
  if (!operario || !unidad) throw new Error("Ejecuta antes el seed");

  // Ubicación libre para la prueba
  const almacen = await prisma.almacen.create({
    data: {
      nombre: `${MARCA} Almacén`,
      pasillos: {
        create: {
          codigo: "SZ1",
          nombre: "Zona sync",
          estanterias: { create: { codigo: "SE1", ubicaciones: { create: { codigo: "SE1-N1-H1" } } } },
        },
      },
    },
    include: { pasillos: { include: { estanterias: { include: { ubicaciones: true } } } } },
  });
  const ubicacionId = almacen.pasillos[0].estanterias[0].ubicaciones[0].id;

  // Lote tal como lo envía el outbox del operario tras contar sin cobertura:
  // recuento → 3 líneas → incidencia → finalizar
  const recuentoId = randomUUID();
  const lineaIds = [randomUUID(), randomUUID(), randomUUID()];
  const ahora = new Date().toISOString();

  const lote = [
    { tipo: "iniciar_recuento", payload: { id: recuentoId, ubicacionId, iniciadoEn: ahora } },
    ...lineaIds.map((id, i) => ({
      tipo: "upsert_linea",
      payload: {
        id,
        recuentoId,
        descripcionArticulo: `${MARCA} Artículo ${i + 1}`,
        cantidad: (i + 1) * 5,
        unidadMedidaId: unidad.id,
        textoOcr: null,
        esIncidencia: false,
        estado: "ACTIVA",
        createdAt: ahora,
        updatedAt: ahora,
      },
    })),
    {
      tipo: "upsert_incidencia",
      payload: {
        id: randomUUID(),
        lineaRecuentoId: lineaIds[2],
        notaOperario: `${MARCA} sin etiqueta`,
        createdAt: ahora,
        updatedAt: ahora,
      },
    },
    {
      tipo: "finalizar_recuento",
      payload: { id: recuentoId, firmaNombre: MARCA, firmaNbi: "TEST", finalizadoEn: ahora },
    },
  ];

  // Aplicación EN SERIE, como hace /api/sync
  const resultados = [];
  for (const op of lote) {
    resultados.push(await procesarOperacion(randomUUID(), op.tipo, op.payload, operario.id));
  }

  comprobar(
    resultados.every((r) => r.ok),
    `Todas las operaciones del lote se aplican (${resultados.filter((r) => r.ok).length}/${lote.length})`
  );

  const recuento = await prisma.recuento.findUnique({
    where: { id: recuentoId },
    include: { lineas: { include: { incidencia: true } } },
  });
  comprobar(recuento !== null, "El recuento existe en la base de datos");
  comprobar(recuento?.lineas.length === 3, "Las 3 líneas se guardaron (ninguna perdida)");
  comprobar(recuento?.estado === "FINALIZADO", "El recuento queda finalizado y firmado");
  comprobar(
    recuento?.lineas.some((l) => l.incidencia !== null) ?? false,
    "La incidencia quedó ligada a su línea"
  );

  // Idempotencia: reenviar el mismo lote no duplica nada
  for (const op of lote) {
    await procesarOperacion(randomUUID(), op.tipo, op.payload, operario.id);
  }
  const lineasTrasReenvio = await prisma.lineaRecuento.count({ where: { recuentoId } });
  comprobar(lineasTrasReenvio === 3, "Reenviar el lote NO duplica líneas (idempotente)");

  // Limpieza
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
