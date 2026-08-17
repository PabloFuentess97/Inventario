"use client";

import { createContext, useContext, useEffect } from "react";
import { syncManager } from "@/lib/offline/sync";
import { precargarEstructura } from "@/lib/offline/operaciones";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  nbi: string;
}

const ContextoUsuario = createContext<UsuarioSesion | null>(null);

/** Cada cuánto se vuelve a descargar la estructura del almacén (con conexión). */
const INTERVALO_ESTRUCTURA_MS = 60_000;

export function useUsuario(): UsuarioSesion {
  const usuario = useContext(ContextoUsuario);
  if (!usuario) throw new Error("useUsuario debe usarse dentro de ProveedorUsuario");
  return usuario;
}

/**
 * Proveedor del usuario en sesión para la zona del operario.
 * Además arranca el motor de sincronización y precarga la estructura
 * del almacén en IndexedDB (cuando hay red) para trabajar sin conexión.
 */
export function ProveedorUsuario({
  usuario,
  children,
}: {
  usuario: UsuarioSesion;
  children: React.ReactNode;
}) {
  useEffect(() => {
    syncManager.iniciar();
    void precargarEstructura();

    // Refresca la estructura de forma periódica y al recuperar conexión, para
    // que las pasillos/estanterías/ubicaciones que cree la oficina aparezcan
    // en el móvil sin tener que cerrar y abrir la aplicación.
    const intervalo = setInterval(() => {
      if (navigator.onLine) void precargarEstructura();
    }, INTERVALO_ESTRUCTURA_MS);

    const alVolverOnline = () => void precargarEstructura();
    const alVolverAlFrente = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void precargarEstructura();
      }
    };
    window.addEventListener("online", alVolverOnline);
    document.addEventListener("visibilitychange", alVolverAlFrente);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("online", alVolverOnline);
      document.removeEventListener("visibilitychange", alVolverAlFrente);
    };
  }, []);

  return <ContextoUsuario.Provider value={usuario}>{children}</ContextoUsuario.Provider>;
}
