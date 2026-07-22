-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('OPERARIO', 'OFICINISTA', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoRecuento" AS ENUM ('EN_PROGRESO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "EstadoLinea" AS ENUM ('ACTIVA', 'ANULADA');

-- CreateEnum
CREATE TYPE "EstadoIncidencia" AS ENUM ('ABIERTA', 'RESUELTA');

-- CreateEnum
CREATE TYPE "EstadoGrupoSimilitud" AS ENUM ('PENDIENTE', 'UNIFICADO', 'SEPARADO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nbi" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacenes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estancias" (
    "id" TEXT NOT NULL,
    "almacenId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "estancias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estanterias" (
    "id" TEXT NOT NULL,
    "estanciaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "estanterias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ubicaciones" (
    "id" TEXT NOT NULL,
    "estanteriaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nivel" INTEGER,
    "hueco" INTEGER,
    "descripcion" TEXT,

    CONSTRAINT "ubicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recuentos" (
    "id" TEXT NOT NULL,
    "ubicacionId" TEXT NOT NULL,
    "operarioId" TEXT NOT NULL,
    "estado" "EstadoRecuento" NOT NULL DEFAULT 'EN_PROGRESO',
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEn" TIMESTAMP(3),
    "firmaNombre" TEXT,
    "firmaNbi" TEXT,

    CONSTRAINT "recuentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lineas_recuento" (
    "id" TEXT NOT NULL,
    "recuentoId" TEXT NOT NULL,
    "descripcionArticulo" TEXT NOT NULL DEFAULT '',
    "cantidad" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unidadMedidaId" TEXT,
    "textoOcr" TEXT,
    "fotoEtiquetaUrl" TEXT,
    "esIncidencia" BOOLEAN NOT NULL DEFAULT false,
    "estado" "EstadoLinea" NOT NULL DEFAULT 'ACTIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lineas_recuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_medida" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "unidades_medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias" (
    "id" TEXT NOT NULL,
    "lineaRecuentoId" TEXT NOT NULL,
    "abiertaPorId" TEXT NOT NULL,
    "estado" "EstadoIncidencia" NOT NULL DEFAULT 'ABIERTA',
    "fotoUrl" TEXT,
    "notaOperario" TEXT,
    "resueltaPorId" TEXT,
    "descripcionResolucion" TEXT,
    "resueltaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_similitud" (
    "id" TEXT NOT NULL,
    "descripcionCanonica" TEXT,
    "estado" "EstadoGrupoSimilitud" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_similitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_similitud_lineas" (
    "grupoId" TEXT NOT NULL,
    "lineaId" TEXT NOT NULL,

    CONSTRAINT "grupos_similitud_lineas_pkey" PRIMARY KEY ("grupoId","lineaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_nbi_key" ON "usuarios"("nbi");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "estancias_almacenId_codigo_key" ON "estancias"("almacenId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "estanterias_estanciaId_codigo_key" ON "estanterias"("estanciaId", "codigo");

-- CreateIndex
CREATE INDEX "ubicaciones_codigo_idx" ON "ubicaciones"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "ubicaciones_estanteriaId_codigo_key" ON "ubicaciones"("estanteriaId", "codigo");

-- CreateIndex
CREATE INDEX "recuentos_ubicacionId_idx" ON "recuentos"("ubicacionId");

-- CreateIndex
CREATE INDEX "recuentos_operarioId_idx" ON "recuentos"("operarioId");

-- CreateIndex
CREATE INDEX "recuentos_estado_idx" ON "recuentos"("estado");

-- CreateIndex
CREATE INDEX "lineas_recuento_recuentoId_idx" ON "lineas_recuento"("recuentoId");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_medida_codigo_key" ON "unidades_medida"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "incidencias_lineaRecuentoId_key" ON "incidencias"("lineaRecuentoId");

-- CreateIndex
CREATE INDEX "incidencias_estado_idx" ON "incidencias"("estado");

-- CreateIndex
CREATE INDEX "grupos_similitud_estado_idx" ON "grupos_similitud"("estado");

-- AddForeignKey
ALTER TABLE "estancias" ADD CONSTRAINT "estancias_almacenId_fkey" FOREIGN KEY ("almacenId") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estanterias" ADD CONSTRAINT "estanterias_estanciaId_fkey" FOREIGN KEY ("estanciaId") REFERENCES "estancias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicaciones" ADD CONSTRAINT "ubicaciones_estanteriaId_fkey" FOREIGN KEY ("estanteriaId") REFERENCES "estanterias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuentos" ADD CONSTRAINT "recuentos_ubicacionId_fkey" FOREIGN KEY ("ubicacionId") REFERENCES "ubicaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuentos" ADD CONSTRAINT "recuentos_operarioId_fkey" FOREIGN KEY ("operarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_recuento" ADD CONSTRAINT "lineas_recuento_recuentoId_fkey" FOREIGN KEY ("recuentoId") REFERENCES "recuentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lineas_recuento" ADD CONSTRAINT "lineas_recuento_unidadMedidaId_fkey" FOREIGN KEY ("unidadMedidaId") REFERENCES "unidades_medida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_lineaRecuentoId_fkey" FOREIGN KEY ("lineaRecuentoId") REFERENCES "lineas_recuento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_abiertaPorId_fkey" FOREIGN KEY ("abiertaPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias" ADD CONSTRAINT "incidencias_resueltaPorId_fkey" FOREIGN KEY ("resueltaPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_similitud_lineas" ADD CONSTRAINT "grupos_similitud_lineas_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_similitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_similitud_lineas" ADD CONSTRAINT "grupos_similitud_lineas_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "lineas_recuento"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Extensiones e índices adicionales (no gestionados por Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensión de trigramas para la detección de similitudes por texto
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice GIN de trigramas sobre la descripción del artículo (búsqueda de similitud)
CREATE INDEX "lineas_recuento_descripcion_trgm_idx"
  ON "lineas_recuento" USING GIN ("descripcionArticulo" gin_trgm_ops);

-- Bloqueo de ubicación: solo puede existir UN recuento EN_PROGRESO por ubicación
CREATE UNIQUE INDEX "recuentos_ubicacion_en_progreso_unico"
  ON "recuentos" ("ubicacionId")
  WHERE "estado" = 'EN_PROGRESO';
