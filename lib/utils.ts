import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea una fecha en formato español corto: 21/07/2026 13:45 */
export function formatearFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formatea una cantidad decimal sin ceros innecesarios: 12, 12,5, 0,375 */
export function formatearCantidad(cantidad: number | string): string {
  const n = typeof cantidad === "string" ? parseFloat(cantidad) : cantidad;
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString("es-ES", { maximumFractionDigits: 3 });
}
