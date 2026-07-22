"use client";

import { v4 as uuid } from "uuid";
import { dbLocal, type OperacionOutbox } from "./db-local";

/**
 * Motor de sincronización (patrón outbox).
 *
 * - Cada cambio local encola una operación con UUID (idempotente: reenviar
 *   no duplica, el servidor hace upsert por id).
 * - flush() envía las operaciones en orden FIFO a /api/sync y después sube
 *   las fotos pendientes. Si algo falla, se reintenta con backoff exponencial.
 * - Se dispara al volver la conexión (evento online / Background Sync del
 *   service worker), periódicamente y al volver la pestaña a primer plano.
 *
 * Resolución de conflictos: last-write-wins por línea usando updatedAt del
 * cliente; las operaciones críticas (iniciar/finalizar recuento) las valida
 * el servidor y, si las rechaza, el estado local se marca en conflicto.
 */

export type EstadoSync = {
  online: boolean;
  sincronizando: boolean;
  pendientes: number;
  ultimoError: string | null;
};

type Oyente = () => void;

const BACKOFF_BASE_MS = 3_000;
const BACKOFF_MAX_MS = 5 * 60_000;
const INTERVALO_PERIODICO_MS = 30_000;

class SyncManager {
  private estado: EstadoSync = {
    online: true,
    sincronizando: false,
    pendientes: 0,
    ultimoError: null,
  };
  private oyentes = new Set<Oyente>();
  private timerBackoff: ReturnType<typeof setTimeout> | null = null;
  private iniciado = false;
  private flushEnCurso: Promise<void> | null = null;

  /** Arranca los listeners globales. Llamar una vez desde el layout del operario. */
  iniciar() {
    if (this.iniciado || typeof window === "undefined") return;
    this.iniciado = true;

    this.estado.online = navigator.onLine;

    window.addEventListener("online", () => {
      this.actualizar({ online: true });
      void this.flush();
    });
    window.addEventListener("offline", () => this.actualizar({ online: false }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.flush();
    });

    // El service worker avisa (Background Sync) cuando el navegador recupera red
    navigator.serviceWorker?.addEventListener("message", (evento) => {
      if (evento.data?.tipo === "SYNC_PENDIENTES") void this.flush();
    });

    setInterval(() => void this.flush(), INTERVALO_PERIODICO_MS);

    void this.refrescarPendientes();
    void this.flush();
  }

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  getEstado(): EstadoSync {
    return this.estado;
  }

  private actualizar(parcial: Partial<EstadoSync>) {
    this.estado = { ...this.estado, ...parcial };
    this.oyentes.forEach((o) => o());
  }

  async refrescarPendientes() {
    const ops = await dbLocal.outbox.count();
    const fotosPendientes = await dbLocal.fotos.filter((f) => !f.subida).count();
    this.actualizar({ pendientes: ops + fotosPendientes });
  }

  /** Encola una operación y dispara la sincronización. */
  async encolar(tipo: OperacionOutbox["tipo"], payload: Record<string, unknown>) {
    await dbLocal.outbox.add({
      opId: uuid(),
      tipo,
      payload,
      createdAt: new Date().toISOString(),
      intentos: 0,
      ultimoError: null,
    });
    await this.refrescarPendientes();
    // Pedir Background Sync al SW (si está disponible) y sincronizar ya
    void this.registrarBackgroundSync();
    void this.flush();
  }

  private async registrarBackgroundSync() {
    try {
      const reg = (await navigator.serviceWorker?.ready) as
        | (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
        | undefined;
      await reg?.sync?.register("sync-outbox");
    } catch {
      // Sin soporte (iOS Safari): nos apoyamos en el evento online + intervalo
    }
  }

  /** Envía todo lo pendiente. Seguro frente a llamadas concurrentes. */
  async flush(): Promise<void> {
    if (this.flushEnCurso) return this.flushEnCurso;
    this.flushEnCurso = this.flushInterno().finally(() => {
      this.flushEnCurso = null;
    });
    return this.flushEnCurso;
  }

  private async flushInterno(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.actualizar({ online: false });
      return;
    }

    const ops = await dbLocal.outbox.orderBy("secuencia").toArray();
    const fotosPendientes = await dbLocal.fotos.filter((f) => !f.subida).toArray();
    if (ops.length === 0 && fotosPendientes.length === 0) {
      this.actualizar({ pendientes: 0, sincronizando: false });
      return;
    }

    this.actualizar({ sincronizando: true, ultimoError: null });

    try {
      // 1) Operaciones de datos, en orden
      if (ops.length > 0) {
        const respuesta = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operaciones: ops.map((o) => ({
              opId: o.opId,
              tipo: o.tipo,
              payload: o.payload,
            })),
          }),
        });

        if (!respuesta.ok) throw new Error(`Sincronización fallida (HTTP ${respuesta.status})`);

        const { resultados } = (await respuesta.json()) as {
          resultados: { opId: string; ok: boolean; codigo?: string; error?: string }[];
        };

        for (const r of resultados) {
          const op = ops.find((o) => o.opId === r.opId);
          if (!op) continue;
          if (r.ok || r.codigo === "YA_APLICADA") {
            await dbLocal.outbox.where("opId").equals(r.opId).delete();
          } else if (r.codigo === "UBICACION_OCUPADA" && op.tipo === "iniciar_recuento") {
            // Conflicto de bloqueo: otro operario empezó antes en esa ubicación.
            // Se descarta la operación y se marca el recuento local.
            await dbLocal.outbox.where("opId").equals(r.opId).delete();
            const recuentoId = op.payload.id as string;
            await dbLocal.recuentos.update(recuentoId, { conflicto: true });
          } else if (r.codigo === "RECHAZADA") {
            // El servidor la rechaza de forma definitiva (p. ej. recuento ya
            // finalizado por la oficina): no tiene sentido reintentar.
            await dbLocal.outbox.where("opId").equals(r.opId).delete();
          } else {
            await dbLocal.outbox
              .where("opId")
              .equals(r.opId)
              .modify({ intentos: op.intentos + 1, ultimoError: r.error ?? "Error desconocido" });
          }
        }
      }

      // 2) Fotos en diferido
      for (const foto of fotosPendientes) {
        const formulario = new FormData();
        formulario.append("archivo", foto.blob, `${foto.id}`);
        formulario.append("destino", foto.destino);
        formulario.append("entidadId", foto.entidadId);
        formulario.append("fotoId", foto.id);

        const respuesta = await fetch("/api/uploads", { method: "POST", body: formulario });
        if (!respuesta.ok) {
          // La entidad puede no existir aún en el servidor si su op falló:
          // se dejará para el siguiente intento.
          continue;
        }
        const { url } = (await respuesta.json()) as { url: string };
        await dbLocal.transaction("rw", [dbLocal.fotos, dbLocal.lineas, dbLocal.incidencias], async () => {
          await dbLocal.fotos.update(foto.id, { subida: true });
          if (foto.destino === "linea") {
            await dbLocal.lineas.update(foto.entidadId, { fotoEtiquetaUrl: url, fotoLocalId: null });
          } else {
            await dbLocal.incidencias.update(foto.entidadId, { fotoUrl: url, fotoLocalId: null });
          }
        });
        // El blob ya está en el servidor: liberar espacio
        await dbLocal.fotos.delete(foto.id);
      }

      await this.refrescarPendientes();
      this.actualizar({ sincronizando: false, online: true });

      // ¿Quedó algo con error? → programar reintento con backoff
      const restantes = await dbLocal.outbox.count();
      const fotosRestantes = await dbLocal.fotos.filter((f) => !f.subida).count();
      if (restantes + fotosRestantes > 0) this.programarReintento();
    } catch (error) {
      // Sin red o servidor caído: no es un error para el usuario, los datos
      // están a salvo en el dispositivo y se reintentará solo.
      this.actualizar({
        sincronizando: false,
        ultimoError: error instanceof Error ? error.message : "Error de red",
      });
      this.programarReintento();
    }
  }

  private programarReintento() {
    if (this.timerBackoff) return;
    dbLocal.outbox
      .orderBy("secuencia")
      .first()
      .then((primera) => {
        const intentos = primera?.intentos ?? 0;
        const espera = Math.min(BACKOFF_BASE_MS * 2 ** intentos, BACKOFF_MAX_MS);
        this.timerBackoff = setTimeout(() => {
          this.timerBackoff = null;
          void this.flush();
        }, espera);
      });
  }
}

export const syncManager = new SyncManager();
