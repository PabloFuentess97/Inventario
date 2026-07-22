/**
 * Prueba manual del algoritmo de similitudes con datos sintéticos.
 * Inserta un recuento con descripciones típicas, ejecuta el análisis y
 * muestra los grupos. Con --limpiar borra los datos de prueba al final.
 *
 * Uso: npx tsx scripts/probar-similitudes.ts [--limpiar] [umbral]
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { generarGruposSimilitud } from "../lib/similitud";

const prisma = new PrismaClient();

const DESCRIPCIONES = [
  // Deberían agruparse entre sí (mismo artículo, nombres distintos)
  "cuerpo de 105mm",
  "vaso de 105mm",
  "Cuerpo de bomba 105 mm",
  "CUERPO BOMBA 105MM",
  "cuerpo bomba 105mm acero inox",
  // Deberían agruparse (acentos / espaciado)
  "Tubería PVC 50mm",
  "tuberia pvc 50 mm",
  // No deberían mezclarse con lo anterior
  "Caja tornillos M6",
  "Palet madera 120x80",
  "Guantes nitrilo talla L",
];

async function main() {
  const limpiar = process.argv.includes("--limpiar");
  const umbralArg = process.argv.find((a) => /^\d*\.?\d+$/.test(a));
  const umbral = umbralArg ? parseFloat(umbralArg) : undefined;

  const operario = await prisma.usuario.findFirst({ where: { rol: "OPERARIO" } });
  const ubicacion = await prisma.ubicacion.findFirst();
  if (!operario || !ubicacion) throw new Error("Ejecuta antes el seed (npm run db:seed)");

  const marcador = "[PRUEBA-SIM]";
  const recuentoId = randomUUID();
  await prisma.recuento.create({
    data: {
      id: recuentoId,
      ubicacionId: ubicacion.id,
      operarioId: operario.id,
      estado: "FINALIZADO",
      finalizadoEn: new Date(),
      firmaNombre: marcador,
      firmaNbi: "TEST",
      lineas: {
        create: DESCRIPCIONES.map((d) => ({
          id: randomUUID(),
          descripcionArticulo: d,
          cantidad: 1,
        })),
      },
    },
  });

  const creados = await generarGruposSimilitud(umbral);
  console.log(`\nGrupos creados: ${creados} (umbral ${umbral ?? process.env.SIMILITUD_UMBRAL ?? 0.4})\n`);

  const grupos = await prisma.grupoSimilitud.findMany({
    where: { estado: "PENDIENTE" },
    include: { lineas: { include: { linea: true } } },
  });
  for (const [i, g] of grupos.entries()) {
    console.log(`Grupo ${i + 1} (canónica sugerida: «${g.descripcionCanonica}»)`);
    for (const l of g.lineas) console.log(`   - ${l.linea.descripcionArticulo}`);
  }

  if (limpiar) {
    await prisma.grupoSimilitud.deleteMany({ where: { estado: "PENDIENTE" } });
    await prisma.recuento.deleteMany({ where: { firmaNombre: marcador } });
    console.log("\nDatos de prueba eliminados.");
  } else {
    console.log("\n(Deja los datos para revisarlos en la app; borra con --limpiar)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
