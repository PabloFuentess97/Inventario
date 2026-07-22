/**
 * Adaptador de almacenamiento de archivos (fotos de etiquetas e incidencias).
 * Permite cambiar de proveedor (disco local, S3/MinIO…) sin tocar el resto
 * del código: el resto de la app solo conoce esta interfaz.
 */
export interface StorageProvider {
  /**
   * Guarda un archivo y devuelve la URL pública relativa con la que
   * se podrá servir (se almacena en BD).
   */
  guardar(buffer: Buffer, nombreArchivo: string, contentType: string): Promise<string>;

  /** Recupera el contenido de un archivo guardado previamente (por su clave). */
  leer(clave: string): Promise<{ buffer: Buffer; contentType: string } | null>;
}
