"use client";

import Dexie, { type EntityTable } from "dexie";

/**
 * Base de datos local (IndexedDB vía Dexie).
 *
 * Es la FUENTE DE VERDAD para el operario: la UI de recuento lee y escribe
 * siempre aquí, nunca espera a la red. Un outbox (cola de operaciones)
 * replica los cambios al servidor cuando hay conexión.
 */

/** Ubicación aplanada con toda su ruta, para navegar y buscar sin conexión. */
export interface UbicacionLocal {
  id: string;
  codigo: string;
  nivel: number | null;
  hueco: number | null;
  descripcion: string | null;
  estanteriaId: string;
  estanteriaCodigo: string;
  estanciaId: string;
  estanciaCodigo: string;
  estanciaNombre: string;
  almacenId: string;
  almacenNombre: string;
  /** true si el servidor informó de un recuento EN_PROGRESO de otro operario. */
  ocupada: boolean;
}

export interface UnidadLocal {
  id: string;
  codigo: string;
  nombre: string;
}

export interface RecuentoLocal {
  id: string;
  ubicacionId: string;
  ubicacionCodigo: string;
  /** Ruta legible: "Almacén Central · Zona 1 · E01 · E01-N1-H2" */
  ruta: string;
  estado: "EN_PROGRESO" | "FINALIZADO";
  iniciadoEn: string; // ISO
  finalizadoEn: string | null;
  firmaNombre: string | null;
  firmaNbi: string | null;
  /** true si el servidor rechazó el inicio (ubicación ocupada por otro operario). */
  conflicto?: boolean;
}

export interface LineaLocal {
  id: string;
  recuentoId: string;
  descripcionArticulo: string;
  cantidad: number;
  unidadMedidaId: string | null;
  textoOcr: string | null;
  esIncidencia: boolean;
  estado: "ACTIVA" | "ANULADA";
  createdAt: string;
  updatedAt: string; // ISO — marca para last-write-wins
  /** id de la foto en la tabla fotos (aún sin subir) */
  fotoLocalId: string | null;
  /** URL en servidor una vez subida */
  fotoEtiquetaUrl: string | null;
}

export interface IncidenciaLocal {
  id: string;
  lineaRecuentoId: string;
  recuentoId: string;
  notaOperario: string;
  estado: "ABIERTA" | "RESUELTA";
  fotoLocalId: string | null;
  fotoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Foto capturada, guardada como Blob hasta que se sube al servidor. */
export interface FotoLocal {
  id: string;
  blob: Blob;
  contentType: string;
  /** A qué entidad pertenece */
  destino: "linea" | "incidencia";
  entidadId: string;
  subida: boolean;
  createdAt: string;
}

/** Operación pendiente de enviar al servidor (patrón outbox). */
export interface OperacionOutbox {
  opId: string; // UUID — idempotencia
  secuencia?: number; // autoincremento Dexie, garantiza orden FIFO
  tipo:
    | "iniciar_recuento"
    | "upsert_linea"
    | "upsert_incidencia"
    | "finalizar_recuento";
  payload: Record<string, unknown>;
  createdAt: string;
  intentos: number;
  ultimoError: string | null;
}

class BaseLocal extends Dexie {
  ubicaciones!: EntityTable<UbicacionLocal, "id">;
  unidades!: EntityTable<UnidadLocal, "id">;
  recuentos!: EntityTable<RecuentoLocal, "id">;
  lineas!: EntityTable<LineaLocal, "id">;
  incidencias!: EntityTable<IncidenciaLocal, "id">;
  fotos!: EntityTable<FotoLocal, "id">;
  outbox!: EntityTable<OperacionOutbox, "secuencia">;

  constructor() {
    super("inventario-local");
    this.version(1).stores({
      ubicaciones: "id, codigo, estanteriaId, estanciaId",
      unidades: "id, codigo",
      recuentos: "id, ubicacionId, estado",
      lineas: "id, recuentoId, updatedAt",
      incidencias: "id, lineaRecuentoId, recuentoId",
      fotos: "id, entidadId, subida",
      outbox: "++secuencia, opId, tipo",
    });
  }
}

export const dbLocal = new BaseLocal();
