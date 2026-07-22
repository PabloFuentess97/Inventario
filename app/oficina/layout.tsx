import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ClipboardList,
  FileSpreadsheet,
  GitMerge,
  LayoutDashboard,
  ListChecks,
  Ruler,
  Users,
  Warehouse,
} from "lucide-react";
import { auth } from "@/auth";
import { BotonCerrarSesion } from "@/components/boton-cerrar-sesion";

export const metadata = { title: "Oficina" };

const enlaces = [
  { href: "/oficina", etiqueta: "Panel", icono: LayoutDashboard },
  { href: "/oficina/estructura", etiqueta: "Estructura", icono: Warehouse },
  { href: "/oficina/recuentos", etiqueta: "Recuentos", icono: ListChecks },
  { href: "/oficina/incidencias", etiqueta: "Incidencias", icono: AlertTriangle },
  { href: "/oficina/similitudes", etiqueta: "Similitudes", icono: GitMerge },
  { href: "/oficina/informes", etiqueta: "Informes", icono: FileSpreadsheet },
  { href: "/oficina/unidades", etiqueta: "Unidades", icono: Ruler },
];

export default async function LayoutOficina({ children }: { children: React.ReactNode }) {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");
  const esAdmin = sesion.user.rol === "ADMIN";

  return (
    <div className="flex min-h-dvh">
      {/* Barra lateral (escritorio) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-surface md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <ClipboardList className="h-5 w-5 text-accent" />
          Inventario
        </div>
        <nav className="grid gap-1 p-3">
          {enlaces.map(({ href, etiqueta, icono: Icono }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Icono className="h-4 w-4" />
              {etiqueta}
            </Link>
          ))}
          {esAdmin && (
            <Link
              href="/admin/usuarios"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Users className="h-4 w-4" />
              Usuarios
            </Link>
          )}
        </nav>
        <div className="mt-auto border-t p-3 text-sm">
          <p className="truncate font-medium">{sesion.user.nombre}</p>
          <p className="truncate text-xs text-muted">
            {esAdmin ? "Administración" : "Oficina"} · NBI {sesion.user.nbi}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-surface/95 px-4 backdrop-blur">
          {/* Navegación compacta en móvil/tablet */}
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {enlaces.map(({ href, etiqueta }) => (
              <Link
                key={href}
                href={href}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover"
              >
                {etiqueta}
              </Link>
            ))}
            {esAdmin && (
              <Link
                href="/admin/usuarios"
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-muted hover:bg-surface-hover"
              >
                Usuarios
              </Link>
            )}
          </nav>
          <div className="hidden md:block" />
          <BotonCerrarSesion />
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
