import type { NextAuthConfig } from "next-auth";

/**
 * Configuración de Auth.js compatible con el middleware (edge):
 * no importa Prisma ni bcrypt. Los providers se añaden en auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // 12 horas: suficiente para una jornada de recuento sin re-login
    maxAge: 12 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.rol = user.rol;
        token.nbi = user.nbi;
        token.nombre = user.nombre;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.rol = token.rol;
        session.user.nbi = token.nbi;
        session.user.nombre = token.nombre;
      }
      return session;
    },
  },
  providers: [], // se rellenan en auth.ts
} satisfies NextAuthConfig;
