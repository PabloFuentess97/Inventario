import { signOut } from "@/auth";
import { BotonSalir } from "@/components/boton-salir";

export function BotonCerrarSesion() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <BotonSalir />
    </form>
  );
}
