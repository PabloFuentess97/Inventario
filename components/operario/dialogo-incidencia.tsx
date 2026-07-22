"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Camera } from "lucide-react";
import { Button, Label, Modal, TextArea, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import type { LineaLocal } from "@/lib/offline/db-local";
import { abrirIncidencia } from "@/lib/offline/operaciones";

/**
 * Diálogo para abrir una incidencia: el operario no sabe qué es el artículo,
 * pero DEBE contar igualmente (cantidad y unidad quedan en la línea).
 * Adjunta foto del artículo y una nota para la oficina.
 */
export function DialogoIncidencia({
  linea,
  onCerrar,
}: {
  linea: LineaLocal | null;
  onCerrar: () => void;
}) {
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  async function confirmar() {
    if (!linea) return;
    setGuardando(true);
    try {
      await abrirIncidencia(linea, nota.trim(), foto);
      toast.success("Incidencia abierta. La oficina la revisará.", {
        description: "Recuerda: la cantidad contada queda registrada.",
      });
      setNota("");
      setFoto(null);
      onCerrar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal isOpen={linea !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                No sé qué es este artículo
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Cuenta la cantidad igualmente en la línea. La oficina identificará el artículo
                con tu foto y tu nota, sin tener que volver a contar.
              </p>

              <div className="flex flex-col gap-2">
                <Label>Foto del artículo</Label>
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-surface-secondary text-muted transition-colors active:bg-surface-hover"
                >
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(foto)}
                      alt="Foto de la incidencia"
                      className="h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <>
                      <Camera className="h-8 w-8" />
                      <span className="text-sm font-medium">Hacer foto</span>
                    </>
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
                    if (archivo) setFoto(archivo);
                    e.target.value = "";
                  }}
                />
              </div>

              <TextField fullWidth value={nota} onChange={setNota}>
                <Label>Nota para la oficina</Label>
                <TextArea placeholder="Ej.: pallet sin etiqueta junto a la columna, cajas azules…" />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={onCerrar}>
                Cancelar
              </Button>
              <Button onPress={confirmar} isDisabled={guardando}>
                Abrir incidencia
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
