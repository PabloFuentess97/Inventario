import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Detección de similitudes entre descripciones de artículo usando la
 * extensión pg_trgm de PostgreSQL (similitud de trigramas).
 *
 * Estrategia:
 *  1. Se toman las descripciones DISTINTAS de las líneas activas (sin
 *     incidencia pendiente) que no pertenezcan ya a un grupo decidido.
 *  2. Se comparan entre sí NORMALIZADAS (minúsculas y sin acentos, para que
 *     «Tubería» ≈ «tuberia») con la puntuación combinada:
 *        GREATEST(similarity, word_similarity en ambas direcciones)
 *     word_similarity detecta cuando una descripción está contenida en otra
 *     más larga («cuerpo bomba 105mm» dentro de «cuerpo bomba 105mm acero
 *     inox»), donde similarity() a secas puntúa bajo.
 *  3. Con union-find se forman componentes conexas: cada componente con dos
 *     o más descripciones distintas se convierte en un GrupoSimilitud
 *     PENDIENTE con todas sus líneas asociadas.
 *
 * Umbral: 0,40 por defecto (calibrado con pares reales: los relacionados
 * puntúan ≥ 0,43 y los no relacionados ≤ 0,17 con la métrica combinada).
 * Configurable por petición (panel de oficina) o con SIMILITUD_UMBRAL.
 *
 * Al regenerar se descartan los grupos PENDIENTE anteriores; las decisiones
 * ya tomadas (UNIFICADO / SEPARADO) se conservan y sus líneas no se
 * vuelven a proponer.
 */
export async function generarGruposSimilitud(umbral?: number): Promise<number> {
  const limite = umbral ?? Number(process.env.SIMILITUD_UMBRAL ?? 0.4);

  // 1) Limpiar propuestas anteriores no decididas
  await prisma.grupoSimilitud.deleteMany({ where: { estado: "PENDIENTE" } });

  // Líneas ya cubiertas por una decisión previa
  const decididas = await prisma.grupoSimilitudLinea.findMany({
    where: { grupo: { estado: { in: ["UNIFICADO", "SEPARADO"] } } },
    select: { lineaId: true },
  });
  const lineasDecididas = decididas.map((d) => d.lineaId);

  // 2) Pares de descripciones similares (pg_trgm sobre texto normalizado)
  const pares = await prisma.$queryRaw<{ d1: string; d2: string; sim: number }[]>`
    WITH descripciones AS (
      SELECT DISTINCT
        "descripcionArticulo" AS d,
        translate(lower("descripcionArticulo"), 'áéíóúüñ', 'aeiouun') AS dn
      FROM "lineas_recuento"
      WHERE "estado" = 'ACTIVA'
        AND "esIncidencia" = false
        AND length(trim("descripcionArticulo")) >= 3
        AND "recuentoId" IN (SELECT "id" FROM "recuentos" WHERE "archivado" = false)
        ${
          lineasDecididas.length > 0
            ? Prisma.sql`AND "id" NOT IN (${Prisma.join(lineasDecididas)})`
            : Prisma.empty
        }
    )
    SELECT d1, d2, sim FROM (
      SELECT a.d AS d1, b.d AS d2,
        GREATEST(
          similarity(a.dn, b.dn),
          word_similarity(a.dn, b.dn),
          word_similarity(b.dn, a.dn)
        )::float AS sim
      FROM descripciones a
      JOIN descripciones b ON a.d < b.d
    ) pares
    WHERE sim >= ${limite}
  `;

  if (pares.length === 0) return 0;

  // 3) Union-find sobre descripciones
  const padre = new Map<string, string>();
  const buscar = (x: string): string => {
    if (!padre.has(x)) padre.set(x, x);
    let raiz = x;
    while (padre.get(raiz) !== raiz) raiz = padre.get(raiz)!;
    // compresión de camino
    let actual = x;
    while (padre.get(actual) !== raiz) {
      const siguiente = padre.get(actual)!;
      padre.set(actual, raiz);
      actual = siguiente;
    }
    return raiz;
  };
  const unir = (a: string, b: string) => {
    padre.set(buscar(a), buscar(b));
  };
  for (const { d1, d2 } of pares) unir(d1, d2);

  const componentes = new Map<string, string[]>();
  for (const d of new Set(pares.flatMap((p) => [p.d1, p.d2]))) {
    const raiz = buscar(d);
    componentes.set(raiz, [...(componentes.get(raiz) ?? []), d]);
  }

  // 4) Crear grupos con sus líneas
  let creados = 0;
  for (const descripciones of componentes.values()) {
    if (descripciones.length < 2) continue;

    const lineas = await prisma.lineaRecuento.findMany({
      where: {
        descripcionArticulo: { in: descripciones },
        estado: "ACTIVA",
        esIncidencia: false,
        recuento: { archivado: false },
        ...(lineasDecididas.length > 0 ? { id: { notIn: lineasDecididas } } : {}),
      },
      select: { id: true },
    });
    if (lineas.length < 2) continue;

    await prisma.grupoSimilitud.create({
      data: {
        // Como sugerencia inicial, la descripción más frecuente/larga
        descripcionCanonica: descripciones.sort((a, b) => b.length - a.length)[0],
        lineas: { create: lineas.map((l) => ({ lineaId: l.id })) },
      },
    });
    creados++;
  }

  return creados;
}
