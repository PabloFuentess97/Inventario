/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

/**
 * Service worker (Serwist).
 *
 * - Precachea el app shell y los assets estáticos → la app ARRANCA sin conexión.
 * - Los assets de tesseract.js (wasm + idioma) se cachean en la primera visita
 *   para que el OCR funcione sin cobertura.
 * - La estructura de ubicaciones usa NetworkFirst con respaldo en caché.
 * - Los datos del recuento NO pasan por aquí: viven en IndexedDB (Dexie) y se
 *   sincronizan con el outbox; el SW solo avisa cuando hay Background Sync.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Assets del OCR (worker, wasm, idioma): grandes y estáticos
      matcher: ({ url }) => url.pathname.startsWith("/tesseract/"),
      handler: new CacheFirst({
        cacheName: "ocr-assets",
        plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 })],
      }),
    },
    {
      // Estructura del almacén: respaldo offline si la precarga manual falla
      matcher: ({ url }) => url.pathname === "/api/estructura",
      handler: new NetworkFirst({ cacheName: "api-estructura", networkTimeoutSeconds: 5 }),
    },
    {
      // Fotos ya subidas al servidor
      matcher: ({ url }) => url.pathname.startsWith("/api/archivos/"),
      handler: new CacheFirst({
        cacheName: "fotos",
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// Background Sync: cuando el navegador recupera conexión, avisamos a las
// pestañas abiertas para que vacíen el outbox de IndexedDB.
self.addEventListener("sync", (evento) => {
  if (evento.tag === "sync-outbox") {
    evento.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clientes) => {
        for (const cliente of clientes) {
          cliente.postMessage({ tipo: "SYNC_PENDIENTES" });
        }
      })
    );
  }
});

serwist.addEventListeners();
