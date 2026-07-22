"use client";

/** Fetch con manejo de errores en español para las páginas de oficina. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    try {
      const datos = await respuesta.json();
      if (datos?.error) mensaje = datos.error;
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(mensaje);
  }

  return respuesta.json() as Promise<T>;
}
