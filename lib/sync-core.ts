import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generarGruposSimilitud } from "@/lib/similitud";

/**
 * Núcleo de aplicación de las operaciones de sincronización del operario.
 *
 * Es IDEMPOTENTE: todas las entidades llevan UUID generado en cliente, de modo
 * que reenviar una operación ya aplicada no duplica nada. Este módulo lo usan
 * tanto el endpoint /api/sync (encolando) como el worker de BullMQ (aplicando).
 *
 * Códigos de resultado por operación:
 *  - ok: true                → aplicada
 *  - codigo: "YA_APLICADA"   → idempotencia, el cliente la descarta
 *  - codigo: "UBICACION_OCUPADA" → bloqueo: otro operario cuenta esa ubicación
 *  - codigo: "RECHAZADA"     → inválida de forma definitiva, no reintentar
 *  - ok: false (sin código)  → error transitorio, el cliente reintentará
 */

export const TIPOS_OPERACION = [
  "iniciar_recuento",
  "upsert_linea",
  "upsert_incidencia",
  "finalizar_recuento",
] as const;

export type TipoOperacion = (typeof TIPOS_OPERACION)[number];

export const operacionSchema = z.object({
  opId: z.string().uuid(),
  tipo: z.enum(TIPOS_OPERACION),
  payload: z.record(z.unknown()),
});

export type Operacion = z.infer<typeof operacionSchema>;

export const cuerpoSyncSchema = z.object({
  operaciones: z.array(operacionSchema).max(500),
});

export type Resultado = { opId: string; ok: boolean; codigo?: string; error?: string };

const iniciarRecuentoSchema = z.object({
  id: z.string().uuid(),
  ubicacionId: z.string(),
  iniciadoEn: z.string().datetime(),
});

const upsertLineaSchema = z.object({
  id: z.string().uuid(),
  recuentoId: z.string().uuid(),
  descripcionArticulo: z.string().max(2000).default(""),
  cantidad: z.number().min(0).max(999_999_999),
  unidadMedidaId: z.string().nullable(),
  textoOcr: z.string().max(10_000).nullable(),
  esIncidencia: z.boolean(),
  estado: z.enum(["ACTIVA", "ANULADA"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const upsertIncidenciaSchema = z.object({
  id: z.string().uuid(),
  lineaRecuentoId: z.string().uuid(),
  notaOperario: z.string().max(4000).default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const finalizarRecuentoSchema = z.object({
  id: z.string().uuid(),
  firmaNombre: z.string().min(1).max(200),
  firmaNbi: z.string().min(1).max(50),
  finalizadoEn: z.string().datetime(),
});

/**
 * Aplica UNA operación a la base de datos y devuelve su resultado.
 *
 * Reglas importantes para la cola:
 *  - Los rechazos de negocio (ubicación ocupada, no existe, ya aplicada…) se
 *    devuelven como Resultado, NO se lanzan: son "éxitos" desde el punto de
 *    vista del worker (no deben reintentarse en Redis).
 *  - Solo se LANZA ante errores transitorios (BD caída, etc.), para que BullMQ
 *    reintente con backoff sin perder el trabajo.
 */
export async function procesarOperacion(
  opId: string,
  tipo: string,
  payload: Record<string, unknown>,
  operarioId: string
): Promise<Resultado> {
  switch (tipo) {
    case "iniciar_recuento": {
      const datos = iniciarRecuentoSchema.parse(payload);

      const existente = await prisma.recuento.findUnique({ where: { id: datos.id } });
      if (existente) return { opId, ok: true, codigo: "YA_APLICADA" };

      const ubicacion = await prisma.ubicacion.findUnique({ where: { id: datos.ubicacionId } });
      if (!ubicacion) {
        return { opId, ok: false, codigo: "RECHAZADA", error: "La ubicación no existe" };
      }

      try {
        await prisma.recuento.create({
          data: {
            id: datos.id,
            ubicacionId: datos.ubicacionId,
            operarioId,
            iniciadoEn: new Date(datos.iniciadoEn),
          },
        });
        return { opId, ok: true };
      } catch (error) {
        // Violación del índice único parcial: ya hay un recuento EN_PROGRESO
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return {
            opId,
            ok: false,
            codigo: "UBICACION_OCUPADA",
            error: "Otro operario tiene un recuento en curso en esta ubicación",
          };
        }
        throw error;
      }
    }

    case "upsert_linea": {
      const datos = upsertLineaSchema.parse(payload);

      const recuento = await prisma.recuento.findUnique({ where: { id: datos.recuentoId } });
      if (!recuento) {
        return { opId, ok: false, codigo: "RECHAZADA", error: "El recuento no existe en el servidor" };
      }
      if (recuento.operarioId !== operarioId) {
        return { opId, ok: false, codigo: "RECHAZADA", error: "El recuento pertenece a otro operario" };
      }

      const existente = await prisma.lineaRecuento.findUnique({ where: { id: datos.id } });
      // Last-write-wins: solo se aplica si la marca del cliente es más reciente
      if (existente && existente.updatedAt >= new Date(datos.updatedAt)) {
        return { opId, ok: true, codigo: "YA_APLICADA" };
      }

      const campos = {
        descripcionArticulo: datos.descripcionArticulo,
        cantidad: new Prisma.Decimal(datos.cantidad),
        unidadMedidaId: datos.unidadMedidaId,
        textoOcr: datos.textoOcr,
        esIncidencia: datos.esIncidencia,
        estado: datos.estado,
        updatedAt: new Date(datos.updatedAt),
      };

      await prisma.lineaRecuento.upsert({
        where: { id: datos.id },
        create: {
          id: datos.id,
          recuentoId: datos.recuentoId,
          createdAt: new Date(datos.createdAt),
          ...campos,
        },
        update: campos,
      });
      return { opId, ok: true };
    }

    case "upsert_incidencia": {
      const datos = upsertIncidenciaSchema.parse(payload);

      const linea = await prisma.lineaRecuento.findUnique({
        where: { id: datos.lineaRecuentoId },
        include: { recuento: true },
      });
      if (!linea) {
        // La línea aún no ha llegado (orden FIFO lo evita, pero por seguridad se reintenta)
        return { opId, ok: false, error: "La línea de la incidencia aún no existe" };
      }
      if (linea.recuento.operarioId !== operarioId) {
        return { opId, ok: false, codigo: "RECHAZADA", error: "La línea pertenece a otro operario" };
      }

      const existente = await prisma.incidencia.findUnique({ where: { id: datos.id } });
      if (existente) {
        // Una incidencia ya resuelta por la oficina no se sobrescribe
        if (existente.estado === "RESUELTA" || existente.updatedAt >= new Date(datos.updatedAt)) {
          return { opId, ok: true, codigo: "YA_APLICADA" };
        }
        await prisma.incidencia.update({
          where: { id: datos.id },
          data: { notaOperario: datos.notaOperario, updatedAt: new Date(datos.updatedAt) },
        });
        return { opId, ok: true };
      }

      await prisma.incidencia.create({
        data: {
          id: datos.id,
          lineaRecuentoId: datos.lineaRecuentoId,
          abiertaPorId: operarioId,
          notaOperario: datos.notaOperario,
          createdAt: new Date(datos.createdAt),
          updatedAt: new Date(datos.updatedAt),
        },
      });
      return { opId, ok: true };
    }

    case "finalizar_recuento": {
      const datos = finalizarRecuentoSchema.parse(payload);

      const recuento = await prisma.recuento.findUnique({ where: { id: datos.id } });
      if (!recuento) {
        return { opId, ok: false, codigo: "RECHAZADA", error: "El recuento no existe en el servidor" };
      }
      if (recuento.operarioId !== operarioId) {
        return { opId, ok: false, codigo: "RECHAZADA", error: "El recuento pertenece a otro operario" };
      }
      if (recuento.estado === "FINALIZADO") {
        return { opId, ok: true, codigo: "YA_APLICADA" };
      }

      // Operación crítica: la valida el servidor (no last-write-wins)
      await prisma.recuento.update({
        where: { id: datos.id, estado: "EN_PROGRESO" },
        data: {
          estado: "FINALIZADO",
          finalizadoEn: new Date(datos.finalizadoEn),
          firmaNombre: datos.firmaNombre,
          firmaNbi: datos.firmaNbi,
        },
      });
      return { opId, ok: true };
    }

    default:
      return { opId, ok: false, codigo: "RECHAZADA", error: `Tipo de operación desconocido: ${tipo}` };
  }
}

/**
 * Al finalizar un recuento se re-analizan las similitudes automáticamente,
 * para que la oficina las tenga listas sin pulsar nada. Nunca debe romper la
 * sincronización del operario, así que traga sus propios errores.
 */
export async function regenerarSimilitudesTrasFinalizar(): Promise<void> {
  try {
    await generarGruposSimilitud();
  } catch (error) {
    console.error("Error al regenerar similitudes tras finalizar recuento:", error);
  }
}
