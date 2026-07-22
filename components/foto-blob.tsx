"use client";

import { useEffect, useState } from "react";
import { dbLocal } from "@/lib/offline/db-local";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

/**
 * Miniatura de foto que resuelve primero la copia local (IndexedDB) y,
 * si ya se subió, la URL del servidor. Así la foto se ve siempre,
 * con o sin conexión.
 */
export function FotoBlob({
  fotoLocalId,
  url,
  alt,
  className,
}: {
  fotoLocalId: string | null;
  url: string | null;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelado = false;

    (async () => {
      if (fotoLocalId) {
        const foto = await dbLocal.fotos.get(fotoLocalId);
        if (foto && !cancelado) {
          objectUrl = URL.createObjectURL(foto.blob);
          setSrc(objectUrl);
          return;
        }
      }
      if (!cancelado) setSrc(url);
    })();

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fotoLocalId, url]);

  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-secondary text-muted", className)}>
        <ImageIcon className="h-6 w-6" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element — blobs locales no pasan por next/image
  return (
    <img src={src} alt={alt} decoding="async" className={cn("object-cover", className)} />
  );
}
