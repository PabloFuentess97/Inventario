import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { auth } from "@/auth";
import { BotonCerrarSesion } from "@/components/boton-cerrar-sesion";
import { BotonInstalarPwa } from "@/components/boton-instalar-pwa";
import { IndicadorSync } from "@/components/indicador-sync";
import { ProveedorUsuario } from "@/components/operario/contexto-usuario";

export const metadata = { title: "Recuento" };

export default async function LayoutOperario({ children }: { children: React.ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");

  return (
    <ProveedorUsuario
      usuario={{ id: sesion.user.id, nombre: sesion.user.nombre, nbi: sesion.user.nbi }}
    >
      <div className="flex min-h-dvh flex-col bg-background-secondary">
        {/* pt de zona segura: en iOS instalada (standalone) el notch no tapa la cabecera */}
        <header className="sticky top-0 z-40 border-b bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-2 px-3">
            <div className="flex items-center gap-2 font-semibold">
              <ClipboardList className="h-5 w-5 text-accent" />
              <span className="hidden sm:inline">Inventario</span>
            </div>
            <div className="flex items-center gap-2">
              <IndicadorSync />
              <BotonInstalarPwa />
              <BotonCerrarSesion />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 p-3 pb-28 sm:p-4 sm:pb-28">{children}</main>
      </div>
    </ProveedorUsuario>
  );
}
