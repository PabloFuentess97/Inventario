-- Borrado lógico (archivado) de la estructura del almacén.
-- Permite "borrar" almacenes, estancias, estanterías y ubicaciones que ya
-- tienen recuentos SIN perder ningún dato: se ocultan de la app y del móvil,
-- pero los recuentos, líneas, fotos e informes siguen intactos.
--
-- Nota: no se toca el índice GIN de trigramas ni el índice único parcial de
-- bloqueo creados en 0001_init (Prisma no los conoce y un diff automático
-- intentaría eliminarlos).

ALTER TABLE "almacenes" ADD COLUMN "archivada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "estancias" ADD COLUMN "archivada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "estanterias" ADD COLUMN "archivada" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ubicaciones" ADD COLUMN "archivada" BOOLEAN NOT NULL DEFAULT false;

-- Consultas del operario y de la oficina filtran por archivada
CREATE INDEX "ubicaciones_archivada_idx" ON "ubicaciones" ("archivada");
