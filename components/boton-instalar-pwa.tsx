"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@heroui/react";
import { toast } from "@/lib/toast";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Botón "Instalar aplicación": aparece solo cuando el navegador dispara
 * beforeinstallprompt (Android/Chrome). En iOS/Safari no existe ese evento;
 * la instalación se hace desde Compartir → "Añadir a pantalla de inicio".
 */
export function BotonInstalarPwa() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const manejador = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", manejador);
    return () => window.removeEventListener("beforeinstallprompt", manejador);
  }, []);

  if (!evento) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onPress={async () => {
        await evento.prompt();
        const eleccion = await evento.userChoice;
        if (eleccion.outcome === "accepted") {
          toast.success("Aplicación instalada");
          setEvento(null);
        }
      }}
    >
      <Download className="h-4 w-4" />
      Instalar app
    </Button>
  );
}
