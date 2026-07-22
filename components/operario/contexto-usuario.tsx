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
  }, []);

  return <ContextoUsuario.Provider value={usuario}>{children}</ContextoUsuario.Provider>;
}
