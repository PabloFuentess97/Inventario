"use client";

import { AlertTriangle } from "lucide-react";
import { Button, Modal } from "@heroui/react";

/**
 * Confirmación sencilla y reutilizable para acciones reversibles
 * (archivar / restaurar). Para lo irreversible se usa el diálogo de borrado
 * de estructura, que además exige escribir el código.
 */
export function DialogoConfirmar({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
  peligroso = false,
  cargando = false,
  onConfirmar,
  onCerrar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar?: string;
  peligroso?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <Modal isOpen={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                {peligroso && <AlertTriangle className="h-5 w-5 text-warning" />}
                {titulo}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="text-sm text-muted">{mensaje}</div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={onCerrar}>
                Cancelar
              </Button>
              <Button
                variant={peligroso ? "danger" : "primary"}
                isDisabled={cargando}
                onPress={onConfirmar}
              >
                {textoConfirmar}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
