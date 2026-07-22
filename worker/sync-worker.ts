/**
 * Worker de sincronización (BullMQ).
 *
 * Proceso independiente de la app web. Consume la cola `sync-operaciones` y
 * aplica cada operación a Postgres mediante procesarOperacion(). La concurrencia
 * está limitada para no saturar la base de datos aunque muchos dispositivos
 * sincronicen a la vez.
 *
 * Se ejecuta con:  npx tsx worker/sync-worker.ts   (o en su servicio Docker)
 */
import { Worker } from "bullmq";
import { getRedis, NOMBRE_COLA_SYNC, REDIS_URL } from "../lib/queue/conexion";
import {
  procesarOperacion,
  regenerarSimilitudesTrasFinalizar,
  type Resultado,
} from "../lib/sync-core";
import type { DatosTrabajoSync } from "../lib/queue/sync-queue";

if (!REDIS_URL) {
  console.error("REDIS_URL no está definida. El worker necesita Redis para funcionar.");
  process.exit(1);
}

const CONCURRENCIA = Number(process.env.SYNC_WORKER_CONCURRENCY ?? 5);

const worker = new Worker<DatosTrabajoSync, Resultado>(
  NOMBRE_COLA_SYNC,
  async (trabajo) => {
    const { opId, tipo, payload, operarioId } = trabajo.data;
    const resultado = await procesarOperacion(opId, tipo, payload, operarioId);

    // Tras finalizar un recuento, regenerar similitudes (no bloquea ni rompe).
    if (tipo === "finalizar_recuento" && resultado.ok && !resultado.codigo) {
      await regenerarSimilitudesTrasFinalizar();
    }

    // Devolver el Resultado hace que la API que espera lo reciba. OJO: los
    // rechazos de negocio son Resultado (no excepciones), así BullMQ los marca
    // como completados y no los reintenta. Solo se reintenta lo que lanza.
    return resultado;
  },
  {
    connection: getRedis(),
    concurrency: CONCURRENCIA,
  }
);

worker.on("ready", () => {
  console.log(`Worker de sincronización listo (concurrencia ${CONCURRENCIA}).`);
});
worker.on("failed", (trabajo, error) => {
  console.error(`Trabajo ${trabajo?.id} falló (se reintentará):`, error.message);
});
worker.on("error", (error) => {
  console.error("Error del worker:", error.message);
});

// Cierre limpio para no dejar trabajos a medias al parar el contenedor.
async function apagar(sig: string) {
  console.log(`Recibido ${sig}, cerrando worker…`);
  await worker.close();
  process.exit(0);
}
process.on("SIGTERM", () => void apagar("SIGTERM"));
process.on("SIGINT", () => void apagar("SIGINT"));
