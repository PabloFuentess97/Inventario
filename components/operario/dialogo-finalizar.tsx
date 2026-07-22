"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PenLine } from "lucide-react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { useUsuario } from "@/components/operario/contexto-usuario";
import { useEstadoSync } from "@/lib/offline/use-estado-sync";
import { finalizarRecuento } from "@/lib/offline/operaciones";

/**
 * Diálogo de finalización y FIRMA del recuento (nombre + NBI).
 * Si quedan cambios sin sincronizar se informa con calma: la firma también
 * queda guardada en el dispositivo y se enviará al recuperar cobertura.
 */
export function DialogoFinalizar({
  recuentoId,
  totalLineas,
  abierto,
  onCerrar,
}: {
  recuentoId: string;
  totalLineas: number;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const usuario = useUsuario();
  const estadoSync = useEstadoSync();
  const router = useRouter();

  const [nombre, setNombre] = useState(usuario.nombre);
  const [nbi, setNbi] = useState(usuario.nbi);
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (!nombre.trim() || !nbi.trim()) {
      toast.warning("La firma requiere nombre y NBI");
      return;
    }
    setGuardando(true);
    try {
      await finalizarRecuento(recuentoId, nombre.trim(), nbi.trim());
      toast.success("Recuento finalizado y firmado", {
        description: estadoSync.online
          ? "La ubicación queda liberada."
          : "Guardado en el dispositivo, se sincronizará al recuperar conexión.",
      });
      router.replace("/operario");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal isOpen={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Finalizar recuento
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                Vas a cerrar esta ubicación con {totalLineas}{" "}
                {totalLineas === 1 ? "línea contada" : "líneas contadas"}. Después ya no podrás
                editarla (solo la oficina puede reabrirla).
              </p>

              {estadoSync.pendientes > 0 && (
                <p className="rounded-lg bg-surface-secondary p-3 text-sm text-muted">
                  Hay {estadoSync.pendientes} cambios aún sin enviar. No pasa nada: quedan
                  guardados en el dispositivo y se sincronizarán solos al recuperar conexión.
                </p>
              )}

              <TextField fullWidth value={nombre} onChange={setNombre}>
                <Label className="flex items-center gap-1">
                  <PenLine className="h-4 w-4" /> Nombre (firma)
                </Label>
                <Input />
              </TextField>
              <TextField fullWidth value={nbi} onChange={setNbi}>
                <Label>NBI</Label>
                <Input />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={onCerrar}>
                Seguir contando
              </Button>
              <Button onPress={confirmar} isDisabled={guardando}>
                Firmar y finalizar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
