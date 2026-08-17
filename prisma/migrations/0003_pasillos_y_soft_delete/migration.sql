-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Estancia pasa a llamarse PASILLO
--    La jerarquía real del almacén es: Almacén > Pasillo > Estantería > Ubicación
--    (p. ej. Almacén General > D > 11, 12, 13, 14). Se renombra preservando
--    TODOS los datos existentes.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "estancias" RENAME TO "pasillos";
ALTER TABLE "estanterias" RENAME COLUMN "estanciaId" TO "pasilloId";

-- Nombres de índices y restricciones acordes al nuevo nombre
ALTER INDEX "estancias_pkey" RENAME TO "pasillos_pkey";
ALTER INDEX "estancias_almacenId_codigo_key" RENAME TO "pasillos_almacenId_codigo_key";
ALTER INDEX "estanterias_estanciaId_codigo_key" RENAME TO "estanterias_pasilloId_codigo_key";
ALTER TABLE "pasillos" RENAME CONSTRAINT "estancias_almacenId_fkey" TO "pasillos_almacenId_fkey";
ALTER TABLE "estanterias" RENAME CONSTRAINT "estanterias_estanciaId_fkey" TO "estanterias_pasilloId_fkey";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Unidad de medida por defecto (la que se asigna sola al contar)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "unidades_medida" ADD COLUMN "porDefecto" BOOLEAN NOT NULL DEFAULT false;

-- Solo puede haber UNA unidad marcada como por defecto
CREATE UNIQUE INDEX "unidades_medida_por_defecto_unica"
  ON "unidades_medida" ("porDefecto")
  WHERE "porDefecto" = true;

-- Unidades (UD) queda como unidad por defecto si existe
UPDATE "unidades_medida" SET "porDefecto" = true WHERE "codigo" = 'UD';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Borrado lógico (archivado) del resto del sistema, salvo usuarios
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "recuentos" ADD COLUMN "archivado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "incidencias" ADD COLUMN "archivada" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "recuentos_archivado_idx" ON "recuentos" ("archivado");
CREATE INDEX "incidencias_archivada_idx" ON "incidencias" ("archivada");
