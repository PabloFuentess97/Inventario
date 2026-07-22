"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, CheckCircle2, MapPin, Plus, RotateCcw } from "lucide-react";
import { Button, Card, Chip, Skeleton } from "@heroui/react";
import { toast } from "@/lib/toast";
import { LineaCard } from "@/components/operario/linea-card";
import { DialogoIncidencia } from "@/components/operario/dialogo-incidencia";
import { DialogoFinalizar } from "@/components/operario/dialogo-finalizar";
import { dbLocal, type LineaLocal } from "@/lib/offline/db-local";
import { crearLinea, reabrirRecuento } from "@/lib/offline/operaciones";

/**
 * Pantalla de recuento de una ubicación. Flujo por artículo:
 * foto de etiqueta → OCR → contar → elegir unidad. Sin botón de guardar:
 * todo persiste solo en el dispositivo y se sincroniza en segundo plano.
 */
export default function PaginaRecuento() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const recuento = useLiveQuery(() => dbLocal.recuentos.get(id), [id]);
  const lineas =
    useLiveQuery(
      () =>
        dbLocal.lineas
          .where("recuentoId")
          .equals(id)
          .filter((l) => l.estado === "ACTIVA")
          .sortBy("createdAt"),
      [id]
    ) ?? [];
  const unidades = useLiveQuery(() => dbLocal.unidades.toArray(), []) ?? [];

  const [lineaIncidencia, setLineaIncidencia] = useState<LineaLocal | null>(null);
  const [finalizando, setFinalizando] = useState(false);

  // Precalienta el OCR en segundo plano (cuando el navegador esté ocioso) para
  // que la primera foto no espere a que cargue el motor.
  useEffect(() => {
    const idle =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 800);
    let cancelado = false;
    idle(() => {
      if (cancelado) return;
      void import("@/lib/ocr").then((m) => m.getOcr().precalentar?.());
    });
    return () => {
      cancelado = true;
    };
  }, []);

  if (recuento === undefined) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!recuento) {
    return (
      <Card>
        <Card.Content className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-muted">Este recuento no está en este dispositivo.</p>
          <Button onPress={() => router.replace("/operario")}>Volver al inicio</Button>
        </Card.Content>
      </Card>
    );
  }

  const finalizado = recuento.estado === "FINALIZADO";

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera de la ubicación */}
      <Card>
        <Card.Content className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-lg font-bold leading-tight">
              <MapPin className="h-5 w-5 shrink-0 text-accent" />
              {/* line-clamp-1 en vez de truncate: nowrap dispararía el ancho
                  mínimo intrínseco de la tarjeta y desbordaría en móvil */}
              <span className="line-clamp-1">{recuento.ubicacionCodigo}</span>
            </p>
            <p className="line-clamp-1 text-sm text-muted">{recuento.ruta}</p>
          </div>
          <Chip color={finalizado ? "success" : "default"} variant="soft" className="shrink-0">
            {finalizado ? "Finalizado" : `${lineas.length} líneas`}
          </Chip>
        </Card.Content>
      </Card>

      {recuento.conflicto && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger-soft-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Otro operario inició antes un recuento en esta ubicación, por lo que este no se
            puede sincronizar. Consulta con la oficina antes de continuar.
          </p>
        </div>
      )}

      {finalizado && (
        <div className="flex flex-col gap-3 rounded-lg border border-success/40 bg-success-soft p-3 text-sm text-success-soft-foreground">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Recuento finalizado y firmado por {recuento.firmaNombre} (NBI {recuento.firmaNbi}).
              Puedes ver lo contado o reabrirlo para volver a contar.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onPress={async () => {
              await reabrirRecuento(recuento.id);
              toast.success("Recuento reabierto: ya puedes volver a contar");
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Reabrir y volver a contar
          </Button>
        </div>
      )}

      {/* Líneas contadas */}
      {lineas.map((linea) => (
        <LineaCard
          key={linea.id}
          linea={linea}
          unidades={unidades}
          soloLectura={finalizado}
          onAbrirIncidencia={setLineaIncidencia}
        />
      ))}

      {lineas.length === 0 && !finalizado && (
        <p className="py-8 text-center text-sm text-muted">
          Aún no hay artículos. Pulsa «Añadir artículo» y haz una foto de la etiqueta.
        </p>
      )}

      {/* Acciones fijas abajo: cómodas con una mano. El padding inferior extra
          respeta la zona segura de iOS (barra de gestos) en modo PWA. */}
      {!finalizado && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Button
              size="lg"
              className="flex-1"
              onPress={async () => {
                await crearLinea(recuento.id);
              }}
            >
              <Plus className="h-5 w-5" />
              Añadir artículo
            </Button>
            <Button
              size="lg"
              variant="outline"
              isDisabled={lineas.length === 0}
              onPress={() => setFinalizando(true)}
            >
              <CheckCircle2 className="h-5 w-5 text-success" />
              Finalizar
            </Button>
          </div>
        </div>
      )}

      <DialogoIncidencia linea={lineaIncidencia} onCerrar={() => setLineaIncidencia(null)} />
      <DialogoFinalizar
        recuentoId={recuento.id}
        totalLineas={lineas.length}
        abierto={finalizando}
        onCerrar={() => setFinalizando(false)}
      />
    </div>
  );
}
