"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import { Button, Card, Chip, Input, Label, Modal, Tabs, TextArea, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { apiFetch } from "@/lib/cliente-api";
import { formatearCantidad, formatearFecha } from "@/lib/utils";

interface Incidencia {
  id: string;
  estado: "ABIERTA" | "RESUELTA";
  fotoUrl: string | null;
  notaOperario: string | null;
  descripcionResolucion: string | null;
  createdAt: string;
  resueltaEn: string | null;
  abiertaPor: { nombre: string; nbi: string };
  resueltaPor: { nombre: string } | null;
  linea: {
    id: string;
    cantidad: string;
    descripcionArticulo: string;
    fotoEtiquetaUrl: string | null;
    unidadMedida: { codigo: string; nombre: string } | null;
    recuento: {
      ubicacion: {
        codigo: string;
        estanteria: { codigo: string; estancia: { nombre: string; almacen: { nombre: string } } };
      };
    };
  };
}

/**
 * Panel de incidencias: la oficina identifica el artículo y la incidencia se
 * convierte automáticamente en línea normal conservando cantidad, unidad y
 * ubicación (cuadre directo, sin recontar).
 */
export default function PaginaIncidencias() {
  const [filtro, setFiltro] = useState<"ABIERTA" | "RESUELTA">("ABIERTA");
  const [resolviendo, setResolviendo] = useState<Incidencia | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [nota, setNota] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["incidencias", filtro],
    queryFn: () => apiFetch<{ incidencias: Incidencia[] }>(`/api/incidencias?estado=${filtro}`),
    refetchInterval: 10_000,
  });

  const resolver = useMutation({
    mutationFn: (incidencia: Incidencia) =>
      apiFetch(`/api/incidencias/${incidencia.id}/resolver`, {
        method: "POST",
        body: JSON.stringify({
          descripcion: descripcion.trim(),
          notaResolucion: nota.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Incidencia resuelta", {
        description: "La línea ya cuenta como recuento normal, sin volver a contar.",
      });
      setResolviendo(null);
      setDescripcion("");
      setNota("");
      queryClient.invalidateQueries({ queryKey: ["incidencias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Incidencias</h1>
        <Tabs selectedKey={filtro} onSelectionChange={(k) => setFiltro(k as "ABIERTA" | "RESUELTA")}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Filtrar incidencias">
              <Tabs.Tab id="ABIERTA">
                Abiertas
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="RESUELTA">
                Resueltas
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </div>

      {isLoading && <p className="text-muted">Cargando…</p>}

      {data?.incidencias.length === 0 && (
        <Card>
          <Card.Content className="p-8 text-center text-muted">
            {filtro === "ABIERTA"
              ? "No hay incidencias abiertas. Todo identificado."
              : "Aún no hay incidencias resueltas."}
          </Card.Content>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.incidencias.map((inc) => {
          const u = inc.linea.recuento.ubicacion;
          return (
            <Card key={inc.id} className={inc.estado === "ABIERTA" ? "border-warning/60" : ""}>
              {/* En móvil la foto va arriba a lo ancho; en pantallas mayores, a la izquierda */}
              <Card.Content className="flex flex-col gap-4 sm:flex-row">
                {(inc.fotoUrl || inc.linea.fotoEtiquetaUrl) && (
                  <a
                    href={inc.fotoUrl ?? inc.linea.fotoEtiquetaUrl ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={inc.fotoUrl ?? inc.linea.fotoEtiquetaUrl ?? ""}
                      alt="Foto de la incidencia"
                      className="h-44 w-full rounded-lg border object-cover sm:h-28 sm:w-28"
                    />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <MapPin className="h-4 w-4 text-accent" />
                      {u.codigo}
                    </p>
                    {inc.estado === "ABIERTA" ? (
                      <Chip size="sm" color="warning" variant="soft">
                        <AlertTriangle className="h-3 w-3" /> Abierta
                      </Chip>
                    ) : (
                      <Chip size="sm" color="success" variant="soft">
                        Resuelta
                      </Chip>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    {u.estanteria.estancia.almacen.nombre} · {u.estanteria.estancia.nombre} ·{" "}
                    {u.estanteria.codigo}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">
                      {formatearCantidad(inc.linea.cantidad)} {inc.linea.unidadMedida?.codigo ?? ""}
                    </span>{" "}
                    <span className="text-muted">contados por</span> {inc.abiertaPor.nombre} (
                    {inc.abiertaPor.nbi})
                  </p>
                  {inc.notaOperario && (
                    <p className="mt-1 rounded-md bg-surface-secondary p-2 text-sm italic">
                      «{inc.notaOperario}»
                    </p>
                  )}
                  {inc.estado === "RESUELTA" ? (
                    <p className="mt-2 text-sm">
                      <CheckCircle2 className="mr-1 inline h-4 w-4 text-success" />
                      <span className="font-medium">{inc.linea.descripcionArticulo}</span>
                      <span className="text-muted">
                        {" "}
                        — {inc.resueltaPor?.nombre}, {formatearFecha(inc.resueltaEn)}
                      </span>
                    </p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-3"
                      onPress={() => {
                        setResolviendo(inc);
                        setDescripcion(inc.linea.descripcionArticulo ?? "");
                        setNota("");
                      }}
                    >
                      Identificar y resolver
                    </Button>
                  )}
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={resolviendo !== null} onOpenChange={(o) => !o && setResolviendo(null)}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Resolver incidencia</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-sm text-muted">
                  Indica qué es el artículo. La línea conservará la cantidad (
                  {resolviendo && formatearCantidad(resolviendo.linea.cantidad)}{" "}
                  {resolviendo?.linea.unidadMedida?.codigo}) y su ubicación: pasa a ser un
                  recuento normal sin volver a contar.
                </p>
                <TextField fullWidth value={descripcion} onChange={setDescripcion}>
                  <Label>Descripción del artículo</Label>
                  <Input placeholder="Ej.: Cuerpo de bomba 105 mm" />
                </TextField>
                <TextField fullWidth value={nota} onChange={setNota}>
                  <Label>Nota de resolución (opcional)</Label>
                  <TextArea />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline" onPress={() => setResolviendo(null)}>
                  Cancelar
                </Button>
                <Button
                  isDisabled={!descripcion.trim() || resolver.isPending}
                  onPress={() => resolviendo && resolver.mutate(resolviendo)}
                >
                  Resolver incidencia
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
