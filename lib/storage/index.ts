import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";

let instancia: StorageProvider | null = null;

/** Devuelve el proveedor de almacenamiento configurado en STORAGE_PROVIDER. */
export function getStorage(): StorageProvider {
  if (!instancia) {
    switch (process.env.STORAGE_PROVIDER) {
      // case "s3": {
      //   const { S3StorageProvider } = require("./s3");
      //   instancia = new S3StorageProvider();
      //   break;
      // }
      case "local":
      default:
        instancia = new LocalStorageProvider();
    }
  }
  return instancia;
}

export type { StorageProvider } from "./types";
