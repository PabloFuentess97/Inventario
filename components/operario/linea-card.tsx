"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera, Loader2, ScanText, Trash2 } from "lucide-react";
import { Button, Card, Chip, Input, Label, TextArea, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { CampoSelect } from "@/components/campo-select";
import { FotoBlob } from "@/components/foto-blob";
import { getOcr } from "@/lib/ocr";
import type { LineaLocal, UnidadLocal } from "@/lib/offline/db-local";
import { actualizarLinea, anularLinea, guardarFotoLinea } from "@/lib/offline/operaciones";
import { useDebounce } from "@/lib/use-debounce";

/**
 * Tarjeta de una línea de recuento: foto de etiqueta + OCR, descripción
 * editable, cantidad y unidad. Todo se guarda solo (debounce sobre IndexedDB
 * + cola de sincronización): el operario nunca pulsa "Guardar".
 */
export function LineaCard({
  linea,
  unidades,
  soloLectura,
  onAbrirIncidencia,
}: {
  linea: LineaLocal;
  unidades: UnidadLocal[];
  soloLectura: boolean;
  onAbrirIncidencia: (linea: LineaLocal) => void;
}) {
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [ocrEnCurso, setOcrEnCurso] = useState(false);

  // Estado local inmediato + persistencia con debounce (auto-save)
  const [descripcion, setDescripcion] = useState(linea.descripcionArticulo);
  const [cantidad, setCantidad] = useState(linea.cantidad === 0 ? "" : String(linea.cantidad));

  const guardarDescripcion = useDebounce((valor: string) => {
    void actualizarLinea(linea.id, { descripcionArticulo: valor });
  });
  const guardarCantidad = useDebounce((valor: string) => {
    const numero = parseFloat(valor.replace(",", "."));
    void actualizarLinea(linea.id, { cantidad: Number.isFinite(numero) ? numero : 0 });
  });

  async function alCapturarFoto(archivo: File) {
    // 1) Guardar SIEMPRE la foto en local primero: sin cobertura no se pierde
    await guardarFotoLinea(linea.id, archivo);

    // 2) OCR en el dispositivo (tesseract.js, disponible offline)
    setOcrEnCurso(true);
    try {
      const resultado = await getOcr().reconocer(archivo);
      const cambios: Partial<LineaLocal> = { textoOcr: resultado.texto };
      // El texto OCR precarga la descripción solo si el operario no escribió nada
      if (!descripcion.trim() && resultado.texto) {
        const sugerencia = resultado.texto.split("\n").slice(0, 2).join(" ").slice(0, 200);
        cambios.descripcionArticulo = sugerencia;
        setDescripcion(sugerencia);
      }
      await actualizarLinea(linea.id, cambios);
      if (resultado.texto) toast.success("Etiqueta leída con OCR");
      else toast.info("No se detectó texto en la etiqueta");
    } catch {
      toast.info("Foto guardada. El OCR no está disponible ahora mismo.");
    } finally {
      setOcrEnCurso(false);
    }
  }

  return (
    <Card className={linea.esIncidencia ? "border-warning" : undefined}>
      <Card.Content className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          {/* Foto de la etiqueta */}
          <button
            type="button"
            disabled={soloLectura}
            onClick={() => inputFotoRef.current?.click()}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-focus"
            aria-label="Hacer foto de la etiqueta"
          >
            {linea.fotoLocalId || linea.fotoEtiquetaUrl ? (
              <FotoBlob
                fotoLocalId={linea.fotoLocalId}
                url={linea.fotoEtiquetaUrl}
                alt="Etiqueta"
                className="h-full w-full"
              />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-secondary text-muted">
                <Camera className="h-7 w-7" />
                <span className="text-[11px] font-medium">Foto etiqueta</span>
              </span>
            )}
            {ocrEnCurso && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </span>
            )}
          </button>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) void alCapturarFoto(archivo);
              e.target.value = "";
            }}
          />

          <div className="min-w-0 flex-1">
            <TextField
              fullWidth
              aria-label="Descripción del artículo"
              value={descripcion}
              isDisabled={soloLectura}
              onChange={(valor) => {
                setDescripcion(valor);
                guardarDescripcion(valor);
              }}
            >
              <TextArea placeholder="Descripción del artículo…" className="min-h-[72px] resize-none" />
            </TextField>
            {linea.textoOcr && (
              <p className="mt-1 flex items-start gap-1 text-xs text-muted">
                <ScanText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">OCR: {linea.textoOcr}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-end gap-2">
          <TextField
            fullWidth
            className="flex-1"
            aria-label="Cantidad"
            value={cantidad}
            isDisabled={soloLectura}
            onChange={(valor) => {
              setCantidad(valor);
              guardarCantidad(valor);
            }}
          >
            <Label>Cantidad</Label>
            <Input inputMode="decimal" placeholder="0" className="text-lg font-semibold" />
          </TextField>
          <CampoSelect
            className="flex-1"
            label="Unidad"
            placeholder="Unidad"
            valor={linea.unidadMedidaId}
            isDisabled={soloLectura}
            onCambio={(valor) => void actualizarLinea(linea.id, { unidadMedidaId: valor })}
            opciones={unidades.map((u) => ({ valor: u.id, etiqueta: `${u.nombre} (${u.codigo})` }))}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          {linea.esIncidencia ? (
            <Chip color="warning" variant="soft">
              <AlertTriangle className="h-3.5 w-3.5" />
              Incidencia abierta
            </Chip>
          ) : (
            <Button variant="outline" size="sm" isDisabled={soloLectura} onPress={() => onAbrirIncidencia(linea)}>
              <AlertTriangle className="h-4 w-4 text-warning" />
              No sé qué es
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            isDisabled={soloLectura}
            className="text-muted"
            onPress={() => {
              void anularLinea(linea.id);
              toast("Línea eliminada");
            }}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
