"use client";

import type { ReactNode } from "react";
import { toast as heroToast } from "@heroui/react";

type Opciones = { description?: ReactNode };

/**
 * Envoltorio fino sobre el toast de HeroUI con la misma API que usaba la app
 * (success / error / warning / info + llamada directa), para que el resto del
 * código no dependa de la librería concreta.
 */
export const toast = Object.assign(
  (mensaje: ReactNode, opciones?: Opciones) => heroToast(mensaje, opciones),
  {
    success: (mensaje: ReactNode, opciones?: Opciones) => heroToast.success(mensaje, opciones),
    error: (mensaje: ReactNode, opciones?: Opciones) => heroToast.danger(mensaje, opciones),
    warning: (mensaje: ReactNode, opciones?: Opciones) => heroToast.warning(mensaje, opciones),
    info: (mensaje: ReactNode, opciones?: Opciones) => heroToast.info(mensaje, opciones),
  }
);
