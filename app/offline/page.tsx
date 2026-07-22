import { WifiOff } from "lucide-react";

/**
 * Página de respaldo del service worker para navegaciones sin conexión a
 * rutas que no estaban en caché. El flujo de recuento normal no pasa por
 * aquí: funciona offline contra IndexedDB.
 */
export default function PaginaOffline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-surface-secondary p-4">
        <WifiOff className="h-8 w-8 text-muted" />
      </div>
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-muted">
        Esta pantalla no está disponible sin conexión. Tus recuentos en curso siguen
        guardados en el dispositivo y se sincronizarán automáticamente al recuperar
        la cobertura.
      </p>
    </main>
  );
}
