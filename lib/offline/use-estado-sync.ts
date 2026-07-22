"use client";

import { useSyncExternalStore } from "react";
import { syncManager, type EstadoSync } from "./sync";

const estadoServidor: EstadoSync = {
  online: true,
  sincronizando: false,
  pendientes: 0,
  ultimoError: null,
};

/** Hook para leer el estado de sincronización (indicador siempre visible). */
export function useEstadoSync(): EstadoSync {
  return useSyncExternalStore(
    (cb) => syncManager.suscribir(cb),
    () => syncManager.getEstado(),
    () => estadoServidor
  );
}
