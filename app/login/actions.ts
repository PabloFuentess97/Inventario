"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export async function iniciarSesion(
  _estadoAnterior: string | undefined,
  formulario: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      email: formulario.get("email"),
      password: formulario.get("password"),
      redirectTo: "/",
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      return "Email o contraseña incorrectos";
    }
    // signIn lanza un redirect interno de Next cuando tiene éxito: re-lanzarlo
    throw error;
  }
}
