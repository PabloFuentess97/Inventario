/**
 * Genera los iconos PWA (192, 512, maskable y apple-touch-icon) a partir de
 * un SVG sencillo, usando sharp. Ejecutar con: npm run iconos
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import sharp from "sharp";

const DIR = path.resolve(process.cwd(), "public", "iconos");

// Icono: portapapeles con marca de verificación sobre fondo azul pizarra
const svg = (margen: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${margen > 0 ? 0 : 96}" fill="#3d5a80"/>
  <g transform="translate(${margen}, ${margen}) scale(${(512 - margen * 2) / 512})">
    <rect x="136" y="96" width="240" height="336" rx="28" fill="#f7f7f5"/>
    <rect x="196" y="64" width="120" height="64" rx="20" fill="#e8ecf1"/>
    <rect x="196" y="64" width="120" height="64" rx="20" fill="none" stroke="#293241" stroke-width="10"/>
    <rect x="136" y="96" width="240" height="336" rx="28" fill="none" stroke="#293241" stroke-width="12"/>
    <path d="M 190 270 L 240 330 L 330 200" fill="none" stroke="#3d5a80" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

async function main() {
  mkdirSync(DIR, { recursive: true });

  const normal = Buffer.from(svg(0));
  // La versión maskable necesita margen de seguridad (~20 %)
  const maskable = Buffer.from(svg(80));

  await sharp(normal).resize(192, 192).png().toFile(path.join(DIR, "icono-192.png"));
  await sharp(normal).resize(512, 512).png().toFile(path.join(DIR, "icono-512.png"));
  await sharp(maskable).resize(512, 512).png().toFile(path.join(DIR, "icono-maskable-512.png"));
  await sharp(normal).resize(180, 180).png().toFile(path.join(DIR, "apple-touch-icon.png"));

  // favicon.ico simple (png renombrado no vale; usamos png 32 como favicon alternativo)
  await sharp(normal).resize(32, 32).png().toFile(path.join(DIR, "favicon-32.png"));

  writeFileSync(
    path.join(DIR, "README.txt"),
    "Iconos generados con scripts/generar-iconos.ts (npm run iconos)\n"
  );
  console.log("Iconos generados en public/iconos");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
