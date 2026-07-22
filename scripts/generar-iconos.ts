/**
 * Genera los iconos PWA (192, 512, maskable y apple-touch-icon) a partir de
 * un SVG sencillo, usando sharp. Ejecutar con: npm run iconos
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import sharp from "sharp";

const DIR = path.resolve(process.cwd(), "public", "iconos");

// Colores del logotipo de referencia
const AZUL = "#34519b"; // flechas convergentes
const ROJO = "#c4193c"; // círculo central
const BLANCO = "#ffffff";

/**
 * Icono: mezcla del logotipo de referencia (cuatro flechas azules convergentes
 * + círculo rojo) con un icono de almacén. En el centro, sobre el círculo rojo,
 * una nave con puerta de persiana en blanco. Ambos elementos quedan legibles.
 */
const svg = (margen: number) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${margen > 0 ? 0 : 96}" fill="${BLANCO}"/>
  <g transform="translate(${margen}, ${margen}) scale(${(512 - margen * 2) / 512})">
    <!-- Cuatro flechas azules convergentes (N, S, E, O) con lados cóncavos,
         como el logotipo de referencia: el hueco entre ellas dibuja un círculo -->
    <g fill="${AZUL}">
      <path d="M 150,44 L 362,44 Q 300,150 256,150 Q 212,150 150,44 Z"/>
      <path d="M 150,468 L 362,468 Q 300,362 256,362 Q 212,362 150,468 Z"/>
      <path d="M 44,150 L 44,362 Q 150,300 150,256 Q 150,212 44,150 Z"/>
      <path d="M 468,150 L 468,362 Q 362,300 362,256 Q 362,212 468,150 Z"/>
    </g>

    <!-- Círculo rojo central -->
    <circle cx="256" cy="256" r="66" fill="${ROJO}"/>

    <!-- Almacén en blanco sobre el círculo (tejado a dos aguas + nave) -->
    <g fill="${BLANCO}">
      <polygon points="256,214 302,252 210,252"/>
      <rect x="222" y="250" width="68" height="50" rx="4"/>
    </g>

    <!-- Puerta de persiana (hueco rojo con listones blancos) -->
    <rect x="242" y="266" width="28" height="34" rx="4" fill="${ROJO}"/>
    <g stroke="${BLANCO}" stroke-width="3">
      <line x1="242" y1="277" x2="270" y2="277"/>
      <line x1="242" y1="286" x2="270" y2="286"/>
    </g>
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
