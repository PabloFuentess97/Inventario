"use client";

import { v4 as uuid } from "uuid";
import { dbLocal, type LineaLocal, type RecuentoLocal, type UbicacionLocal } from "./db-local";
import { syncManager } from "./sync";

/**
 * Operaciones de dominio del operario. Todas escriben PRIMERO en IndexedDB
 * (la UI nunca espera a la red) y encolan la réplica hacia el servidor.
 */

/**
 * Descarga la estructura de ubicaciones y unidades para trabajar sin conexión.
 *
 * Se llama al entrar y de forma periódica (ver ProveedorUsuario), para que las
 * estructuras que la oficina cree DESPUÉS aparezcan también en el móvil.
 *
 * Respeta el trabajo local: las ubicaciones donde este operario tiene un
 * recuento EN_PROGRESO se mantienen marcadas como ocupadas aunque el servidor
 * aún no lo sepa (por ejemplo si se inició sin cobertura).
 */
export async function precargarEstructura(): Promise<boolean> {
  try {
    const respuesta = await fetch("/api/estructura");
    if (!respuesta.ok) return false;
    const datos = (await respuesta.json()) as {
      ubicaciones: UbicacionLocal[];
      unidades: { id: string; codigo: string; nombre: string }[];
    };

    // Ubicaciones que este dispositivo está contando ahora mismo
    const enCurso = await dbLocal.recuentos.where("estado").equals("EN_PROGRESO").toArray();
    const ocupadasLocalmente = new Set(enCurso.map((r) => r.ubicacionId));

    await dbLocal.transaction("rw", [dbLocal.ubicaciones, dbLocal.unidades], async () => {
      await dbLocal.ubicaciones.clear();
      await dbLocal.ubicaciones.bulkPut(
        datos.ubicaciones.map((u) =>
          ocupadasLocalmente.has(u.id) ? { ...u, ocupada: true } : u
        )
      );
      await dbLocal.unidades.clear();
      await dbLocal.unidades.bulkPut(datos.unidades);
    });
    return true;
  } catch {
    // Sin conexión: se sigue trabajando con la estructura ya precargada
    return false;
  }
}

/** Inicia un recuento sobre una ubicación (bloqueo optimista + validación en servidor). */
export async function iniciarRecuento(ubicacion: UbicacionLocal): Promise<RecuentoLocal> {
  const ahora = new Date().toISOString();
  const recuento: RecuentoLocal = {
    id: uuid(),
    ubicacionId: ubicacion.id,
    ubicacionCodigo: ubicacion.codigo,
    ruta: `${ubicacion.almacenNombre} · ${ubicacion.estanciaNombre} · ${ubicacion.estanteriaCodigo} · ${ubicacion.codigo}`,
    estado: "EN_PROGRESO",
    iniciadoEn: ahora,
    finalizadoEn: null,
    firmaNombre: null,
    firmaNbi: null,
  };

  await dbLocal.recuentos.add(recuento);
  await dbLocal.ubicaciones.update(ubicacion.id, { ocupada: true });
  await syncManager.encolar("iniciar_recuento", {
    id: recuento.id,
    ubicacionId: recuento.ubicacionId,
    iniciadoEn: ahora,
  });
  return recuento;
}

/** Crea una línea vacía (se rellenará con foto/OCR/cantidad). */
export async function crearLinea(recuentoId: string): Promise<LineaLocal> {
  const ahora = new Date().toISOString();
  const linea: LineaLocal = {
    id: uuid(),
    recuentoId,
    descripcionArticulo: "",
    cantidad: 0,
    unidadMedidaId: null,
    textoOcr: null,
    esIncidencia: false,
    estado: "ACTIVA",
    createdAt: ahora,
    updatedAt: ahora,
    fotoLocalId: null,
    fotoEtiquetaUrl: null,
  };
  await dbLocal.lineas.add(linea);
  await encolarLinea(linea);
  return linea;
}

/** Actualiza campos de una línea (auto-save: se llama con debounce desde la UI). */
export async function actualizarLinea(id: string, cambios: Partial<LineaLocal>): Promise<void> {
  const ahora = new Date().toISOString();
  await dbLocal.lineas.update(id, { ...cambios, updatedAt: ahora });
  const linea = await dbLocal.lineas.get(id);
  if (linea) await encolarLinea(linea);
}

async function encolarLinea(linea: LineaLocal) {
  await syncManager.encolar("upsert_linea", {
    id: linea.id,
    recuentoId: linea.recuentoId,
    descripcionArticulo: linea.descripcionArticulo,
    cantidad: linea.cantidad,
    unidadMedidaId: linea.unidadMedidaId,
    textoOcr: linea.textoOcr,
    esIncidencia: linea.esIncidencia,
    estado: linea.estado,
    createdAt: linea.createdAt,
    updatedAt: linea.updatedAt,
  });
}

/** Anula (borrado lógico) una línea. */
export async function anularLinea(id: string): Promise<void> {
  await actualizarLinea(id, { estado: "ANULADA" });
}

/**
 * Guarda la foto de etiqueta de una línea como Blob local.
 * Se subirá en diferido cuando haya conexión; nunca se pierde.
 */
export async function guardarFotoLinea(lineaId: string, blob: Blob): Promise<string> {
  const fotoId = uuid();
  await dbLocal.transaction("rw", [dbLocal.fotos, dbLocal.lineas], async () => {
    await dbLocal.fotos.add({
      id: fotoId,
      blob,
      contentType: blob.type || "image/jpeg",
      destino: "linea",
      entidadId: lineaId,
      subida: false,
      createdAt: new Date().toISOString(),
    });
    await dbLocal.lineas.update(lineaId, { fotoLocalId: fotoId });
  });
  await syncManager.refrescarPendientes();
  void syncManager.flush();
  return fotoId;
}

/**
 * Abre una incidencia sobre una línea: el operario no sabe qué es el artículo,
 * pero la cantidad y la unidad quedan contadas en la propia línea.
 */
export async function abrirIncidencia(
  linea: LineaLocal,
  nota: string,
  fotoBlob: Blob | null
): Promise<void> {
  const ahora = new Date().toISOString();
  const incidenciaId = uuid();
  let fotoLocalId: string | null = null;

  await dbLocal.transaction("rw", [dbLocal.incidencias, dbLocal.lineas, dbLocal.fotos], async () => {
    if (fotoBlob) {
      fotoLocalId = uuid();
      await dbLocal.fotos.add({
        id: fotoLocalId,
        blob: fotoBlob,
        contentType: fotoBlob.type || "image/jpeg",
        destino: "incidencia",
        entidadId: incidenciaId,
        subida: false,
        createdAt: ahora,
      });
    }
    await dbLocal.incidencias.add({
      id: incidenciaId,
      lineaRecuentoId: linea.id,
      recuentoId: linea.recuentoId,
      notaOperario: nota,
      estado: "ABIERTA",
      fotoLocalId,
      fotoUrl: null,
      createdAt: ahora,
      updatedAt: ahora,
    });
    await dbLocal.lineas.update(linea.id, { esIncidencia: true, updatedAt: ahora });
  });

  const lineaActualizada = await dbLocal.lineas.get(linea.id);
  if (lineaActualizada) await encolarLinea(lineaActualizada);
  await syncManager.encolar("upsert_incidencia", {
    id: incidenciaId,
    lineaRecuentoId: linea.id,
    notaOperario: nota,
    createdAt: ahora,
    updatedAt: ahora,
  });
}

/**
 * Finaliza el recuento con la firma del operario (nombre + NBI).
 * Funciona también sin conexión: el cambio queda local y el servidor
 * lo validará al sincronizar (operación crítica, no LWW).
 */
export async function finalizarRecuento(
  recuentoId: string,
  firmaNombre: string,
  firmaNbi: string
): Promise<void> {
  const ahora = new Date().toISOString();
  const recuento = await dbLocal.recuentos.get(recuentoId);
  await dbLocal.recuentos.update(recuentoId, {
    estado: "FINALIZADO",
    finalizadoEn: ahora,
    firmaNombre,
    firmaNbi,
  });
  if (recuento) {
    await dbLocal.ubicaciones.update(recuento.ubicacionId, { ocupada: false });
  }
  await syncManager.encolar("finalizar_recuento", {
    id: recuentoId,
    firmaNombre,
    firmaNbi,
    finalizadoEn: ahora,
  });
}

/**
 * Reabre un recuento finalizado para volver a contar. Vuelve a poner la
 * ubicación como ocupada por este operario y encola la operación; el servidor
 * la valida (no se puede reabrir si otro operario ya cuenta esa ubicación).
 */
export async function reabrirRecuento(recuentoId: string): Promise<void> {
  const ahora = new Date().toISOString();
  const recuento = await dbLocal.recuentos.get(recuentoId);
  await dbLocal.recuentos.update(recuentoId, {
    estado: "EN_PROGRESO",
    finalizadoEn: null,
    firmaNombre: null,
    firmaNbi: null,
    conflicto: false,
  });
  if (recuento) {
    await dbLocal.ubicaciones.update(recuento.ubicacionId, { ocupada: true });
  }
  await syncManager.encolar("reabrir_recuento", { id: recuentoId, reabiertoEn: ahora });
}
