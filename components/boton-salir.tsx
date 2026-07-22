"use client";

import { LogOut } from "lucide-react";
import { Button } from "@heroui/react";

/** Parte cliente del botón de cerrar sesión (HeroUI solo puede usarse en cliente). */
export function BotonSalir() {
  return (
    <Button variant="ghost" isIconOnly type="submit" aria-label="Cerrar sesión">
      <LogOut className="h-5 w-5" />
    </Button>
  );
}
