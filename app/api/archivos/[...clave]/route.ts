import { getStorage } from "@/lib/storage";
import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";

/** Sirve las fotos guardadas por el proveedor de almacenamiento. */
export const GET = conManejadorErrores(
  async (_peticion: Request, contexto: { params: Promise<{ clave: string[] }> }) => {
    await requireSesion();

    const { clave } = await contexto.params;
    const resultado = await getStorage().leer(clave.join("/"));
    if (!resultado) throw new ApiError(404, "Archivo no encontrado");

    return new Response(new Uint8Array(resultado.buffer), {
      headers: {
        "Content-Type": resultado.contentType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  }
);
