import { NextResponse } from "next/server";
import { conManejadorErrores, requireSesion } from "@/lib/api";
import {
  cuerpoSyncSchema,
  procesarOperacion,
  regenerarSimilitudesTrasFinalizar,
  type Resultado,
} from "@/lib/sync-core";
import { COLA_ACTIVA } from "@/lib/queue/conexion";

/**
 * Endpoint de sincronización del outbox del operario.
 *
 * Con Redis activo (producción), cada operación se ENCOLA en BullMQ con
 * jobId = opId y la API espera su resultado con un tiempo límite:
 *  - El trabajo es durable: si la app se reinicia, no se pierde.
 *  - Un worker con concurrencia controlada aplica los trabajos a Postgres, de
 *    modo que muchos dispositivos sincronizando a la vez NO saturan la BD.
 *  - Si la espera supera el límite, se responde "en cola" (ok:false sin código
 *    terminal); el cliente reintenta el mismo opId, que por idempotencia no
 *    duplica y acaba recibiendo el resultado ya calculado.
 *
 * Sin Redis (desarrollo local), se aplica directamente contra la base de datos.
 */

// Tiempo máximo que la API espera a que el worker procese cada operación.
const ESPERA_MS = 15_000;

export const POST = conManejadorErrores(async (peticion: Request) => {
  const sesion = await requireSesion(["OPERARIO"]);
  const operarioId = sesion.user.id;

  const { operaciones } = cuerpoSyncSchema.parse(await peticion.json());

  const resultados = COLA_ACTIVA
    ? await procesarConCola(operaciones, operarioId)
    : await procesarDirecto(operaciones, operarioId);

  return NextResponse.json({ resultados });
});

/** Camino con Redis: encola y espera el resultado del worker (durable). */
async function procesarConCola(
  operaciones: { opId: string; tipo: string; payload: Record<string, unknown> }[],
  operarioId: string
): Promise<Resultado[]> {
  // Import diferido: solo se carga BullMQ cuando la cola está activa.
  const { getColaSync, getEventosCola } = await import("@/lib/queue/sync-queue");
  const cola = getColaSync();
  const eventos = getEventosCola();

  return Promise.all(
    operaciones.map(async (op): Promise<Resultado> => {
      try {
        const existente = await cola.getJob(op.opId);
        if (existente) {
          const estado = await existente.getState();
          // Ya procesado (reintento del cliente): devolvemos el resultado guardado.
          if (estado === "completed" && existente.returnvalue) {
            return existente.returnvalue as Resultado;
          }
          // Se quedó fallado (p. ej. la BD estuvo caída): al reenviarlo el
          // cliente, lo reintentamos en vez de dejarlo atascado.
          if (estado === "failed") await existente.retry();
          return (await existente.waitUntilFinished(eventos, ESPERA_MS)) as Resultado;
        }

        const trabajo = await cola.add(
          op.tipo,
          { opId: op.opId, tipo: op.tipo, payload: op.payload, operarioId },
          { jobId: op.opId }
        );
        // Espera al worker con límite. Si expira, el trabajo sigue en la cola.
        return (await trabajo.waitUntilFinished(eventos, ESPERA_MS)) as Resultado;
      } catch (error) {
        // Timeout o fallo transitorio: los datos están a salvo en Redis y el
        // cliente reintentará el mismo opId sin duplicar nada.
        const mensaje = error instanceof Error ? error.message : "Error desconocido";
        const esTimeout = /timed out|timeout/i.test(mensaje);
        return {
          opId: op.opId,
          ok: false,
          error: esTimeout
            ? "En cola, se está sincronizando; se reintentará"
            : "Error temporal, se reintentará",
        };
      }
    })
  );
}

/** Camino sin Redis (desarrollo): aplica en el proceso web, en orden FIFO. */
async function procesarDirecto(
  operaciones: { opId: string; tipo: string; payload: Record<string, unknown> }[],
  operarioId: string
): Promise<Resultado[]> {
  const resultados: Resultado[] = [];
  let algunRecuentoFinalizado = false;

  for (const op of operaciones) {
    try {
      const resultado = await procesarOperacion(op.opId, op.tipo, op.payload, operarioId);
      resultados.push(resultado);
      if (op.tipo === "finalizar_recuento" && resultado.ok && !resultado.codigo) {
        algunRecuentoFinalizado = true;
      }
    } catch (error) {
      console.error(`Error procesando operación ${op.tipo}:`, error);
      resultados.push({ opId: op.opId, ok: false, error: "Error al aplicar la operación, se reintentará" });
    }
  }

  if (algunRecuentoFinalizado) await regenerarSimilitudesTrasFinalizar();
  return resultados;
}
