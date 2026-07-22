/** Regenera los grupos de similitud desde consola: npx tsx scripts/regenerar-similitudes.ts [umbral] */
import { generarGruposSimilitud } from "../lib/similitud";
import { prisma } from "../lib/prisma";

async function main() {
  const umbralArg = process.argv.find((a) => /^\d*\.?\d+$/.test(a));
  const creados = await generarGruposSimilitud(umbralArg ? parseFloat(umbralArg) : undefined);
  console.log(`Grupos de similitud regenerados: ${creados}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
