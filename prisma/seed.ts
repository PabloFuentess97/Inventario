/**
 * Seed de datos de ejemplo:
 *  - Usuarios de prueba (admin, oficinista, operario)
 *  - Catálogo de unidades de medida
 *  - Un almacén con pasillos, estanterías y ubicaciones
 *
 * Ejecutar con: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ── Usuarios ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("inventario123", 10);

  const usuarios = [
    { nombre: "Ana Administradora", nbi: "A0001", email: "admin@inventario.local", rol: "ADMIN" as const },
    { nombre: "Olga Oficinista", nbi: "O0001", email: "oficina@inventario.local", rol: "OFICINISTA" as const },
    { nombre: "Pedro Operario", nbi: "P0001", email: "operario@inventario.local", rol: "OPERARIO" as const },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash },
    });
  }

  // ── Unidades de medida ──────────────────────────────────────────────────────
  const unidades = [
    // "Unidades" es la que se asigna automáticamente al contar
    { codigo: "UD", nombre: "Unidades", porDefecto: true },
    { codigo: "M", nombre: "Metros" },
    { codigo: "KG", nombre: "Kilogramos" },
    { codigo: "CAJA", nombre: "Cajas" },
    { codigo: "PALLET", nombre: "Pallets" },
  ];

  for (const um of unidades) {
    await prisma.unidadMedida.upsert({
      where: { codigo: um.codigo },
      update: { porDefecto: um.porDefecto ?? false },
      create: { ...um, porDefecto: um.porDefecto ?? false },
    });
  }

  // ── Estructura del almacén de ejemplo ───────────────────────────────────────
  const existente = await prisma.almacen.findFirst({ where: { nombre: "Almacén Central" } });
  if (!existente) {
    await prisma.almacen.create({
      data: {
        nombre: "Almacén Central",
        descripcion: "Almacén principal de ejemplo",
        pasillos: {
          create: [
            {
              codigo: "Z1",
              nombre: "Zona 1 - Recepción",
              estanterias: {
                create: ["E01", "E02"].map((codigo) => ({
                  codigo,
                  descripcion: `Estantería ${codigo}`,
                  ubicaciones: {
                    create: [1, 2, 3].flatMap((nivel) =>
                      [1, 2, 3, 4].map((hueco) => ({
                        codigo: `${codigo}-N${nivel}-H${hueco}`,
                        nivel,
                        hueco,
                      }))
                    ),
                  },
                })),
              },
            },
            {
              codigo: "Z2",
              nombre: "Zona 2 - Almacenaje",
              estanterias: {
                create: ["E03", "E04", "E05"].map((codigo) => ({
                  codigo,
                  descripcion: `Estantería ${codigo}`,
                  ubicaciones: {
                    create: [1, 2, 3, 4].flatMap((nivel) =>
                      [1, 2, 3, 4, 5].map((hueco) => ({
                        codigo: `${codigo}-N${nivel}-H${hueco}`,
                        nivel,
                        hueco,
                      }))
                    ),
                  },
                })),
              },
            },
          ],
        },
      },
    });
  }

  console.log("Seed completado.");
  console.log("Usuarios de prueba (contraseña: inventario123):");
  console.log("  admin@inventario.local    (ADMIN)");
  console.log("  oficina@inventario.local  (OFICINISTA)");
  console.log("  operario@inventario.local (OPERARIO)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
