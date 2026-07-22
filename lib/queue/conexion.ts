import IORedis from "ioredis";

/**
 * Conexión compartida a Redis. Si REDIS_URL no está definida (p. ej. en
 * desarrollo local con `npm run dev`), la cola queda desactivada y /api/sync
 * aplica las operaciones directamente contra la base de datos.
 */
export const REDIS_URL = process.env.REDIS_URL;
export const COLA_ACTIVA = Boolean(REDIS_URL);

let conexion: IORedis | null = null;

/** Devuelve una conexión IORedis singleton apta para BullMQ. */
export function getRedis(): IORedis {
  if (!REDIS_URL) {
    throw new Error("REDIS_URL no está definida: la cola de sincronización está desactivada");
  }
  if (!conexion) {
    conexion = new IORedis(REDIS_URL, {
      // BullMQ lo exige para bloqueos y streams
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    conexion.on("error", (e) => console.error("Error de conexión con Redis:", e.message));
  }
  return conexion;
}

/** Nombre único de la cola de sincronización del outbox de operarios. */
export const NOMBRE_COLA_SYNC = "sync-operaciones";
