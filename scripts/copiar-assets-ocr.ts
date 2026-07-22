/**
 * Copia los assets de tesseract.js a /public/tesseract para servirlos en local
 * (sin CDN) y que el OCR funcione también SIN CONEXIÓN:
 *   - worker.min.js        (tesseract.js/dist)
 *   - núcleo wasm          (tesseract.js-core)
 *   - idioma español       (spa.traineddata.gz, descargado de tessdata)
 *
 * Ejecutar con: npm run ocr:assets   (necesita conexión la primera vez)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import path from "path";

const RAIZ = process.cwd();
const DESTINO = path.join(RAIZ, "public", "tesseract");
const DESTINO_CORE = path.join(DESTINO, "core");
const DESTINO_LANG = path.join(DESTINO, "lang");

async function main() {
  mkdirSync(DESTINO_CORE, { recursive: true });
  mkdirSync(DESTINO_LANG, { recursive: true });

  // 1) Worker de tesseract.js
  const worker = path.join(RAIZ, "node_modules", "tesseract.js", "dist", "worker.min.js");
  copyFileSync(worker, path.join(DESTINO, "worker.min.js"));

  // 2) Núcleo WASM (todos los variantes .wasm.js / .wasm que distribuye el paquete)
  const coreDir = path.join(RAIZ, "node_modules", "tesseract.js-core");
  for (const archivo of readdirSync(coreDir)) {
    if (archivo.endsWith(".wasm") || archivo.endsWith(".wasm.js") || archivo.endsWith(".js")) {
      copyFileSync(path.join(coreDir, archivo), path.join(DESTINO_CORE, archivo));
    }
  }

  // 3) Idioma español (comprimido .gz, tal como lo espera tesseract.js)
  const destinoLang = path.join(DESTINO_LANG, "spa.traineddata.gz");
  if (!existsSync(destinoLang)) {
    console.log("Descargando spa.traineddata.gz (idioma español para el OCR)…");
    const respuesta = await fetch("https://tessdata.projectnaptha.com/4.0.0/spa.traineddata.gz");
    if (!respuesta.ok) {
      throw new Error(
        `No se pudo descargar el idioma (HTTP ${respuesta.status}). Reintenta con conexión.`
      );
    }
    writeFileSync(destinoLang, Buffer.from(await respuesta.arrayBuffer()));
  }

  console.log("Assets de OCR copiados a public/tesseract");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
