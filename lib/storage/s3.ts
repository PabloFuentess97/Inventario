import type { StorageProvider } from "./types";

/**
 * Adaptador para almacenamiento compatible S3 (MinIO, AWS S3, etc.).
 *
 * Preparado pero NO activo por defecto. Para usarlo:
 *
 *   1. Instalar el SDK:  npm install @aws-sdk/client-s3
 *   2. Configurar en .env:
 *        STORAGE_PROVIDER="s3"
 *        S3_ENDPOINT="http://localhost:9000"   (endpoint de MinIO)
 *        S3_BUCKET="inventario"
 *        S3_ACCESS_KEY_ID="..."
 *        S3_SECRET_ACCESS_KEY="..."
 *        S3_REGION="us-east-1"
 *   3. Descomentar la implementación de abajo y el caso "s3" en index.ts.
 */
export class S3StorageProvider implements StorageProvider {
  constructor() {
    throw new Error(
      "El proveedor S3 no está activado. Instala @aws-sdk/client-s3 y descomenta la implementación en lib/storage/s3.ts"
    );
  }

  async guardar(_buffer: Buffer, _nombreArchivo: string, _contentType: string): Promise<string> {
    throw new Error("No implementado");
  }

  async leer(_clave: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    throw new Error("No implementado");
  }
}

/* ── Implementación de referencia (descomentar tras instalar el SDK) ──────────

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export class S3StorageProvider implements StorageProvider {
  private cliente: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET!;
    this.cliente = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true, // necesario para MinIO
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }

  async guardar(buffer: Buffer, nombreArchivo: string, contentType: string): Promise<string> {
    const extension = contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg";
    const fecha = new Date();
    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}/${nombreArchivo}${extension}`;
    await this.cliente.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: clave, Body: buffer, ContentType: contentType })
    );
    return `/api/archivos/${clave}`;
  }

  async leer(clave: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const respuesta = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: clave })
      );
      const buffer = Buffer.from(await respuesta.Body!.transformToByteArray());
      return { buffer, contentType: respuesta.ContentType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
}
────────────────────────────────────────────────────────────────────────────── */
