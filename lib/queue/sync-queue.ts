import "server-only";
import { Queue, QueueEvents } from "bullmq";
import { getRedis, NOMBRE_COLA_SYNC } from "./conexion";
import type { Resultado } from "@/lib/sync-core";

/**
 * Cola de operaciones de sincronización (BullMQ sobre Redis).
 *
 * Cada operación se encola con jobId = opId (el UUID del cliente), lo que da
 * DEDUPLICACIÓN a nivel de cola: reenviar la misma operación no crea un
 * trabajo duplicado. Los trabajos son durables en Redis (con AOF activado, ver
 * docker-compose), de modo que si la app o el worker se reinician a mitad de
 * una sincronización, ningún dato se pierde: el trabajo sigue en la cola y se
 * aplica al reanudar.
 */

export interface DatosTrabajoSync {
  opId: string;
  tipo: string;
  payload: Record<string, unknown>;
  operarioId: string;
}

let cola: Queue<DatosTrabajoSync, Resultado> | null = null;
let eventos: QueueEvents | null = null;

export function getColaSync(): Queue<DatosTrabajoSync, Resultado> {
  if (!cola) {
    cola = new Queue<DatosTrabajoSync, Resultado>(NOMBRE_COLA_SYNC, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: "exponential", delay: 2_000 },
        // Se conservan los completados un rato para poder recuperar su
        // resultado de forma idempotente si el cliente reintenta.
        removeOnComplete: { age: 3_600, count: 20_000 },
        removeOnFail: { age: 24 * 3_600 },
      },
    });
  }
  return cola;
}

export function getEventosCola(): QueueEvents {
  if (!eventos) {
    eventos = new QueueEvents(NOMBRE_COLA_SYNC, { connection: getRedis() });
  }
  return eventos;
}
