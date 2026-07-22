import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Control de acceso por rol:
 *  - /operario/** → solo OPERARIO
 *  - /oficina/**  → OFICINISTA o ADMIN
 *  - /admin/**    → solo ADMIN
 * Los usuarios no autenticados van a /login.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const sesion = req.auth;

  const esPublica =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/iconos") ||
    pathname.startsWith("/tesseract") ||
    pathname === "/offline";

  if (esPublica) {
    // Un usuario ya autenticado que visita /login vuelve a su panel
    if (pathname === "/login" && sesion?.user) {
      return NextResponse.redirect(new URL(rutaInicio(sesion.user.rol), req.url));
    }
    return NextResponse.next();
  }

  if (!sesion?.user) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  const rol = sesion.user.rol;

  if (pathname.startsWith("/operario") && rol !== "OPERARIO") {
    return NextResponse.redirect(new URL(rutaInicio(rol), req.url));
  }
  if (pathname.startsWith("/oficina") && rol !== "OFICINISTA" && rol !== "ADMIN") {
    return NextResponse.redirect(new URL(rutaInicio(rol), req.url));
  }
  if (pathname.startsWith("/admin") && rol !== "ADMIN") {
    return NextResponse.redirect(new URL(rutaInicio(rol), req.url));
  }

  return NextResponse.next();
});

function rutaInicio(rol: string): string {
  switch (rol) {
    case "OPERARIO":
      return "/operario";
    case "OFICINISTA":
    case "ADMIN":
      return "/oficina";
    default:
      return "/login";
  }
}

export const config = {
  // Excluir estáticos de Next y archivos públicos del middleware
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)).*)"],
};
