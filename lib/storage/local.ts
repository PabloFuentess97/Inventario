import { promises as fs } from "fs";
import path from "path";
import type { StorageProvider } from "./types";

const TIPOS_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const EXTENSION_TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Proveedor por defecto: guarda las fotos en el sistema de archivos local
 * (carpeta data/uploads) y las sirve a través de /api/archivos/[...clave].
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? "data/uploads");
  }

  async guardar(buffer: Buffer, nombreArchivo: string, contentType: string): Promise<string> {
    // El cliente sube siempre JPEG; ante un tipo desconocido asumimos .jpg para
    // que la oficina pueda mostrar la imagen (nunca .bin, que no se ve).
    const extension = TIPOS_EXTENSION[contentType] ?? ".jpg";
    // Subcarpeta por fecha para no acumular miles de archivos en un directorio
    const fecha = new Date();
    const subcarpeta = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    const nombreSeguro = nombreArchivo.replace(/[^a-zA-Z0-9_-]/g, "") + extension;

    const dir = path.join(this.baseDir, subcarpeta);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, nombreSeguro), buffer);

    // Clave relativa que se guarda en BD y se usa en la URL
    return `/api/archivos/${subcarpeta}/${nombreSeguro}`;
  }

  async leer(clave: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    // La clave llega como "2026-07/uuid.jpg"; se valida contra path traversal
    const ruta = path.resolve(this.baseDir, clave);
    if (!ruta.startsWith(this.baseDir)) return null;

    try {
      const buffer = await fs.readFile(ruta);
      const contentType = EXTENSION_TIPOS[path.extname(ruta).toLowerCase()] ?? "application/octet-stream";
      return { buffer, contentType };
    } catch {
      return null;
    }
  }
}
