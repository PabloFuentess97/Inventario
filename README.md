# Inventario · Recuentos físicos de almacén

Aplicación web (PWA offline-first) para realizar **recuentos físicos de inventario**: los operarios recorren el almacén con el móvil, fotografían etiquetas (con OCR), cuentan lo que hay en cada ubicación —incluso **sin cobertura**— y la oficina resuelve incidencias, unifica descripciones similares y exporta informes listos para el ERP.

La app **no gestiona stock**: parte de cero, sin artículos ni existencias. Todo nace del recuento físico.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **PostgreSQL** + **Prisma** (con extensión `pg_trgm` para similitudes)
- **Redis** + **BullMQ**: cola de trabajos que absorbe la sincronización de los dispositivos (ver más abajo)
- **Auth.js (NextAuth v5)** con credenciales y control por rol (operario / oficinista / admin)
- **Tailwind CSS 4** + **HeroUI v3**
- **PWA offline-first**: Serwist (`@serwist/next`) + **Dexie.js** (IndexedDB) con cola de sincronización (outbox)
- **tesseract.js** para OCR de etiquetas en el propio dispositivo (funciona offline)
- **TanStack Query**, **Zod**, **ExcelJS**, **jsPDF**
- **Docker + Docker Compose** para el despliegue en un VPS

## Despliegue en un VPS con Docker (recomendado)

Todo el sistema se levanta con Docker Compose: base de datos, Redis, la app, el worker de la cola y (opcional) un proxy con HTTPS automático.

```bash
# 1) Clonar y configurar secretos
git clone https://github.com/PabloFuentess97/Inventario.git
cd Inventario
cp .env.docker.example .env
#    Edita .env: POSTGRES_PASSWORD, AUTH_SECRET (npx auth secret) y AUTH_URL

# 2) Construir y arrancar todo
docker compose up -d --build

# La app queda en http://IP-DEL-VPS:3000  (usuarios de prueba abajo)
```

Con **HTTPS y dominio propio** (necesario para instalar la PWA en móviles fuera de localhost):

```bash
#    En .env: AUTH_DOMAIN=inventario.tudominio.com  y  AUTH_URL=https://inventario.tudominio.com
docker compose --profile https up -d --build
```

Servicios que levanta el compose:

| Servicio | Qué hace |
| --- | --- |
| `postgres` | Base de datos (volumen `pgdata`, persistente) |
| `redis` | Cola de sincronización con persistencia AOF (volumen `redisdata`) |
| `migrate` | Aplica migraciones y siembra datos (one-shot, se ejecuta y termina) |
| `app` | Aplicación Next.js (web + API) |
| `worker` | Consume la cola y aplica las operaciones a Postgres |
| `caddy` | (perfil `https`) proxy inverso con certificado automático |

Las **fotos** se guardan en el volumen `uploads` (nunca se pierden entre despliegues). Comandos útiles: `docker compose logs -f worker`, `docker compose ps`, `docker compose down` (parar sin borrar datos), `docker compose down -v` (borrar también los volúmenes).

## Borrado seguro de la estructura (solo administrador)

Borrar estructura nunca destruye recuentos. Solo el **administrador** ve los botones de borrado, y siempre con **doble confirmación** (un aviso que explica el impacto real + escribir el código exacto del elemento):

- **Si tiene recuentos → se archiva.** Desaparece de la oficina y de los móviles de los operarios, pero los recuentos, las fotos y los informes siguen intactos y exportables. Es reversible: con «Ver archivadas» el administrador puede **restaurar** lo archivado.
- **Si no tiene ningún recuento → se elimina de verdad**, junto con su contenido (limpieza real de estructura creada por error).

El archivado se aplica en cascada (un almacén archiva sus estancias, estanterías y ubicaciones) para que no queden elementos huérfanos visibles en el móvil. Comprobado con `npx tsx scripts/probar-archivado.ts`.

## Cómo la cola evita perder datos (Redis + BullMQ)

Cuando **uno o muchos dispositivos** recuperan cobertura a la vez, sus outbox vuelcan las operaciones contra `/api/sync`. En lugar de aplicarlas directamente a Postgres (lo que saturaría la BD con muchos operarios), el endpoint las **encola en Redis** y un **worker** con concurrencia controlada las va aplicando:

- **Nada se pierde:** cada operación es un trabajo durable en Redis (con AOF activado). Si la app o el worker se reinician a mitad de una sincronización, el trabajo sigue en la cola y se aplica al reanudar.
- **Sin duplicados:** el trabajo se encola con `jobId = opId` (el UUID del cliente), así que reenviar la misma operación no crea un trabajo nuevo. Es idempotente de extremo a extremo (cliente → cola → BD).
- **La app no se bloquea:** el worker limita cuántas operaciones tocan la BD a la vez (`SYNC_WORKER_CONCURRENCY`), de modo que 50 dispositivos sincronizando no tumban Postgres. Si la espera supera el límite, `/api/sync` responde «en cola» y el dispositivo reintenta el mismo `opId` sin perder nada.
- **Las fotos** ya son seguras por diseño: el dispositivo conserva el `Blob` en IndexedDB hasta que el servidor confirma la subida, y el servidor las escribe en un volumen persistente. El dispositivo reintenta hasta tener confirmación.
- **Reintentos automáticos:** si la BD está caída, el worker reintenta con *backoff* exponencial (hasta 8 intentos) sin que el operario tenga que hacer nada.

> En desarrollo local (`npm run dev`, sin `REDIS_URL`) la cola se desactiva y `/api/sync` aplica las operaciones directamente. Escalar el número de workers es tan simple como `docker compose up -d --scale worker=3`.

## Requisitos (instalación manual, sin Docker)

- Node.js 20 o superior
- PostgreSQL 14 o superior en `localhost:5432` (el usuario debe poder crear la extensión `pg_trgm`; en la migración se hace `CREATE EXTENSION IF NOT EXISTS pg_trgm`)
- (Opcional) Redis 7 para activar la cola de sincronización; sin él, la app aplica la sincronización directamente

## Instalación

```bash
# 1) Dependencias
npm install

# 2) Variables de entorno
copy .env.example .env
#    Edita .env y pon tu contraseña de PostgreSQL en DATABASE_URL
#    y un AUTH_SECRET aleatorio (npx auth secret)

# 3) Crear la base de datos (una vez)
psql -U postgres -h localhost -c "CREATE DATABASE inventario;"

# 4) Migraciones + cliente Prisma
npm run db:migrate
npm run db:generate

# 5) Datos de ejemplo (usuarios, unidades y un almacén con ubicaciones)
npm run db:seed

# 6) Assets de la PWA y del OCR (iconos + tesseract en local, necesita internet una vez)
npm run iconos
npm run ocr:assets
```

## Arranque

```bash
# Desarrollo (el service worker/PWA está desactivado en dev)
npm run dev            # http://localhost:3000

# Producción (necesario para probar PWA y modo offline)
npm run build
npm start
```

### Usuarios de prueba (seed)

| Rol        | Email                       | Contraseña      |
| ---------- | --------------------------- | --------------- |
| Admin      | `admin@inventario.local`    | `inventario123` |
| Oficinista | `oficina@inventario.local`  | `inventario123` |
| Operario   | `operario@inventario.local` | `inventario123` |

## Estructura del proyecto

```
app/                  Rutas por rol: /operario, /oficina, /admin + API (route handlers)
  sw.ts               Service worker (Serwist)
  manifest.ts         Manifest PWA
components/           UI (shadcn-style) y componentes de operario/oficina
lib/
  offline/            Dexie (IndexedDB), outbox y motor de sincronización
  ocr/                Adaptador OcrProvider (tesseract.js + alternativa cloud comentada)
  storage/            Adaptador de almacenamiento de fotos (local + S3/MinIO comentado)
  similitud.ts        Agrupación por trigramas (pg_trgm)
  informes.ts         Filas del informe exportable
prisma/               schema.prisma, migraciones y seed
scripts/              Generación de iconos PWA y copia de assets de OCR
data/uploads/         Fotos subidas (proveedor de almacenamiento local)
```

## Cómo funciona el modo offline (y cómo probarlo)

**Diseño offline-first del operario:**

- La UI de recuento lee y escribe **siempre en IndexedDB** (Dexie); nunca espera a la red.
- Cada cambio encola una operación en un **outbox** con UUID de cliente. Un motor de sincronización la envía a `/api/sync` al volver la conexión (evento `online` + Background Sync del service worker + intervalo periódico), con **reintentos y backoff exponencial**. Los UUID hacen la sincronización **idempotente**: reenviar nunca duplica.
- Las **fotos** se guardan como `Blob` en IndexedDB y se suben en diferido. El **OCR** (tesseract.js) se ejecuta en el propio dispositivo con assets servidos desde `/public/tesseract`, cacheados por el service worker → también funciona sin cobertura.
- La **estructura de ubicaciones** se precarga en IndexedDB al entrar con red.
- **Conflictos**: *last-write-wins* por línea usando la marca de tiempo del cliente (`updatedAt`). Las operaciones críticas (iniciar recuento —bloqueo de ubicación— y finalizar) las **valida el servidor**: si otro operario ganó el bloqueo, el recuento local queda marcado en conflicto y se avisa al operario sin perder sus datos.
- El indicador de estado (en línea / sin conexión / sincronizando / N pendientes) está siempre visible. Estar sin cobertura **nunca** se muestra como error.

**Prueba en escritorio:**

1. `npm run build && npm start` y abre `http://localhost:3000` (el SW solo se activa en producción).
2. Entra como operario, espera a ver "Todo sincronizado" (estructura precargada).
3. DevTools → pestaña **Network** → marca **Offline**.
4. Elige una ubicación, añade líneas, haz fotos (se guardan localmente y el OCR se ejecuta en el navegador), abre una incidencia y **finaliza firmando**. Verás "Sin conexión · N pendientes", sin ningún error.
5. Desmarca Offline: en unos segundos el indicador pasa a "Sincronizando…" y luego "Todo sincronizado". Comprueba en la oficina que el recuento, las líneas, las fotos y la incidencia han llegado **una sola vez** (sin duplicados).

**Prueba en móvil:** instala la app ("Añadir a pantalla de inicio"), activa el **modo avión** y repite el flujo; al desactivarlo todo se sincroniza solo.

## Instalación como app (PWA)

- **Android/Chrome**: aparece el botón "Instalar app" en la cabecera (evento `beforeinstallprompt`) o menú ⋮ → "Instalar aplicación".
- **iOS/Safari**: botón Compartir → "Añadir a pantalla de inicio".
- Se abre a pantalla completa (`display: standalone`, orientación vertical) con iconos propios (192/512/maskable + `apple-touch-icon`).

## Decisiones técnicas destacadas

- **Bloqueo de ubicación**: índice único parcial en PostgreSQL (`recuentos(ubicacionId) WHERE estado='EN_PROGRESO'`) — el bloqueo lo garantiza la BD, no la aplicación, por lo que es seguro con varios operarios simultáneos.
- **Incidencias sin recontar**: la incidencia siempre cuelga de una línea que ya lleva cantidad, unidad y ubicación. Resolverla = identificar el artículo; la línea pasa a recuento normal automáticamente.
- **Similitudes**: puntuación combinada de `pg_trgm` — `GREATEST(similarity, word_similarity` en ambas direcciones`)` sobre texto normalizado (minúsculas y sin acentos), de modo que «Tubería PVC 50mm» ≈ «tuberia pvc 50 mm» y una descripción contenida en otra más larga también se detecta. Umbral 0,40 por defecto (`SIMILITUD_UMBRAL`), ajustable por análisis desde el panel (alta 0,30 / normal 0,40 / estricta 0,55). El análisis se lanza automáticamente al finalizar cada recuento y con el botón del panel; los grupos se forman por componentes conexas (union-find) y las decisiones (unificar/separar) se conservan al re-analizar.
- **OCR y almacenamiento intercambiables**: interfaces `OcrProvider` (`lib/ocr/`) y `StorageProvider` (`lib/storage/`) con implementaciones alternativas (Google Cloud Vision, S3/MinIO) documentadas y listas para descomentar.
- **Tiempo casi real en oficina**: polling ligero con TanStack Query (5–10 s) en panel, recuentos e incidencias.
- **Informes**: Excel (ExcelJS), CSV con BOM y `;` (compatible con Excel/ERP en español) y PDF (jsPDF + autotable), por estantería o por almacén.

## Scripts npm

| Script          | Descripción                                        |
| --------------- | -------------------------------------------------- |
| `dev`           | Desarrollo                                         |
| `build` / `start` | Producción (necesario para PWA/offline)          |
| `db:migrate`    | Aplica las migraciones (`prisma migrate deploy`)   |
| `db:generate`   | Genera el cliente Prisma                           |
| `db:seed`       | Datos de ejemplo                                   |
| `iconos`        | Genera los iconos PWA en `public/iconos`           |
| `ocr:assets`    | Copia tesseract.js a `public/tesseract` + idioma español |
