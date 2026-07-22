import type { Rol } from "@prisma/client";
import type { DefaultSession } from "next-auth";
// Necesario para que la ampliación del módulo "next-auth/jwt" surta efecto
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    nombre: string;
    nbi: string;
    rol: Rol;
  }

  interface Session {
    user: {
      id: string;
      nombre: string;
      nbi: string;
      rol: Rol;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol: Rol;
    nbi: string;
    nombre: string;
  }
}
