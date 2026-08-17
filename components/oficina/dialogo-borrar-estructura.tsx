"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, Trash2 } from "lucide-react";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { apiFetch } from "@/lib/cliente-api";

export type TipoEstructura = "almacen" | "pasillo" | "estanteria" | "ubicacion";

export interface ObjetivoBorrado {
  tipo: TipoEstructura;
  id: string;
  /** Código o nombre que el administrador deberá escribir para confirmar. */
  etiqueta: string;
}

const RECURSOS: Record<TipoEstructura, string> = {
  almacen: "almacenes",
  pasillo: "pasillos",
  estanteria: "estanterias",
  ubicacion: "ubicaciones",
};

const NOMBRES: Record<TipoEstructura, string> = {
  almacen: "almacén",
  pasillo: "pasillo",
  estanteria: "estantería",
  ubicacion: "ubicación",
};

/** Género gramatical de cada tipo, para que los mensajes concuerden. */
const GENERO: Record<TipoEstructura, "m" | "f"> = {
  almacen: "m",
  pasillo: "m",
  estanteria: "f",
  ubicacion: "f",
};

/**
 * Borrado de estructura con DOBLE CONFIRMACIÓN (solo administrador):
 *
 *  1. Se consulta el impacto real: cuántos recuentos dependen del elemento.
 *  2. Se explica qué va a ocurrir:
 *     - Con recuentos → se ARCHIVA: desaparece de la app y de los móviles, pero
 *       los recuentos, fotos e informes se conservan intactos (reversible).
 *     - Sin recuentos → se ELIMINA definitivamente.
 *  3. Para continuar hay que escribir el código exacto del elemento.
 */
export function DialogoBorrarEstructura({
  objetivo,
  onCerrar,
  onExito,
}: {
  objetivo: ObjetivoBorrado | null;
  onCerrar: () => void;
  onExito: () => void;
}) {
  const [confirmacion, setConfirmacion] = useState("");

  useEffect(() => {
    setConfirmacion("");
  }, [objetivo?.id]);

  const { data: impacto, isLoading } = useQuery({
    queryKey: ["impacto-estructura", objetivo?.tipo, objetivo?.id],
    queryFn: () =>
      apiFetch<{ recuentos: number; accion: "archivado" | "eliminado" }>(
        `/api/estructura/impacto?tipo=${objetivo!.tipo}&id=${objetivo!.id}`
      ),
    enabled: objetivo !== null,
  });

  const borrar = useMutation({
    mutationFn: () =>
      apiFetch<{ accion: "archivado" | "eliminado"; recuentos: number }>(
        `/api/${RECURSOS[objetivo!.tipo]}/${objetivo!.id}`,
        { method: "DELETE" }
      ),
    onSuccess: (r) => {
      const nombre = cap(NOMBRES[objetivo!.tipo]);
      // Concordancia: almacén y pasillo son masculinos; estantería y ubicación, femeninas
      const f = GENERO[objetivo!.tipo] === "f";
      if (r.accion === "archivado") {
        toast.success(`${nombre} ${f ? "archivada" : "archivado"}`, {
          description: `Se conservan ${r.recuentos} recuentos con sus fotos e informes. Puedes restaurar${
            f ? "la" : "lo"
          } cuando quieras.`,
        });
      } else {
        toast.success(`${nombre} ${f ? "eliminada" : "eliminado"}`);
      }
      onCerrar();
      onExito();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seArchiva = impacto?.accion === "archivado";
  const puedeConfirmar =
    !isLoading && confirmacion.trim() === objetivo?.etiqueta.trim() && !borrar.isPending;

  return (
    <Modal isOpen={objetivo !== null} onOpenChange={(o) => !o && onCerrar()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="flex items-center gap-2">
                {seArchiva ? (
                  <Archive className="h-5 w-5 text-warning" />
                ) : (
                  <Trash2 className="h-5 w-5 text-danger" />
                )}
                {seArchiva ? "Archivar" : "Eliminar"} {objetivo && NOMBRES[objetivo.tipo]}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {isLoading && <p className="text-sm text-muted">Comprobando datos asociados…</p>}

              {!isLoading && objetivo && (
                <>
                  <p className="text-sm">
                    <span className="font-semibold">{objetivo.etiqueta}</span>
                  </p>

                  {seArchiva ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning-soft-foreground">
                      <p className="flex items-start gap-2 font-medium">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Tiene {impacto?.recuentos} recuentos registrados
                      </p>
                      <p>
                        No se borrará ningún dato: se <b>archivará</b>. Desaparecerá de la oficina
                        y de los móviles de los operarios, pero los recuentos, las fotos y los
                        informes seguirán disponibles, y podrás restaurarlo cuando quieras.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger-soft-foreground">
                      No tiene ningún recuento asociado, así que se <b>eliminará
                      definitivamente</b> junto con todo su contenido (estanterías y
                      ubicaciones). Esta acción no se puede deshacer.
                    </div>
                  )}

                  <TextField fullWidth value={confirmacion} onChange={setConfirmacion}>
                    <Label>
                      Para confirmar, escribe «{objetivo.etiqueta}»
                    </Label>
                    <Input autoComplete="off" placeholder={objetivo.etiqueta} />
                  </TextField>
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={onCerrar}>
                Cancelar
              </Button>
              <Button
                variant={seArchiva ? "primary" : "danger"}
                isDisabled={!puedeConfirmar}
                onPress={() => borrar.mutate()}
              >
                {seArchiva ? "Archivar" : "Eliminar definitivamente"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function cap(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
