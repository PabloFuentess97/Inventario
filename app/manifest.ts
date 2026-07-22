import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Inventario · Recuentos de almacén",
    short_name: "Inventario",
    description:
      "Recuentos físicos de inventario en almacén: cuenta, fotografía etiquetas y sincroniza incluso sin cobertura.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#34519b",
    lang: "es",
    icons: [
      {
        src: "/iconos/icono-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/iconos/icono-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/iconos/icono-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
