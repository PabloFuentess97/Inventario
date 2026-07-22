"use client";

import { CloudOff, CloudUpload, Cloud, Check } from "lucide-react";
import { Chip } from "@heroui/react";
import { useEstadoSync } from "@/lib/offline/use-estado-sync";

/**
 * Indicador de estado de sincronización, siempre visible en la cabecera del
 * operario. Mensajería tranquilizadora: estar sin cobertura NO es un error.
 */
export function IndicadorSync() {
  const estado = useEstadoSync();

  if (!estado.online) {
    return (
      <Chip color="warning" variant="soft" title="Guardado en el dispositivo, se sincronizará al recuperar conexión">
        <CloudOff className="h-4 w-4" />
        Sin conexión
        {estado.pendientes > 0 && <span>· {estado.pendientes}</span>}
      </Chip>
    );
  }

  if (estado.sincronizando) {
    return (
      <Chip color="accent" variant="soft">
        <CloudUpload className="h-4 w-4 animate-pulse" />
        Sincronizando…
      </Chip>
    );
  }

  if (estado.pendientes > 0) {
    return (
      <Chip color="default" variant="soft">
        <Cloud className="h-4 w-4" />
        {estado.pendientes} pendientes
      </Chip>
    );
  }

  return (
    <Chip color="success" variant="soft">
      <Check className="h-4 w-4" />
      Todo sincronizado
    </Chip>
  );
}
