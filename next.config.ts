import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Serwist genera el service worker a partir de app/sw.ts.
// En desarrollo se desactiva (el SW cachearía el bundle de dev);
// para probar el modo offline hay que usar `npm run build && npm start`.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Cabecera innecesaria menos por respuesta
  poweredByHeader: false,
  // Las fotos se sirven desde el sistema de archivos vía route handler,
  // no hace falta configurar dominios de imágenes remotas.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Tree-shaking más agresivo de librerías con muchos exports: reduce el JS
    // que el móvil descarga y parsea.
    optimizePackageImports: ["@heroui/react", "lucide-react", "@tanstack/react-query"],
  },
};

export default withSerwist(nextConfig);
