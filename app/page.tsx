import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** La raíz redirige al panel según el rol (el middleware ya exige sesión). */
export default async function PaginaRaiz() {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");
  redirect(sesion.user.rol === "OPERARIO" ? "/operario" : "/oficina");
}
