"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button, Card, Chip, Table } from "@heroui/react";
import { toast } from "@/lib/toast";
import { apiFetch } from "@/lib/cliente-api";
import { formatearCantidad, formatearFecha } from "@/lib/utils";

interface Detalle {
  recuento: {
    id: string;
    estado: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
    firmaNombre: string | null;
    firmaNbi: string | null;
    operario: { nombre: string; nbi: string };
    ubicacion: {
      codigo: string;
      estanteria: { codigo: string; estancia: { nombre: string; almacen: { nombre: string } } };
    };
    lineas: {
      id: string;
      descripcionArticulo: string;
      cantidad: string;
      textoOcr: string | null;
      fotoEtiquetaUrl: string | null;
      esIncidencia: boolean;
      estado: string;
      unidadMedida: { codigo: string } | null;
      incidencia: { estado: string; notaOperario: string | null } | null;
    }[];
  };
}

export default function PaginaDetalleRecuento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["recuento", id],
    queryFn: () => apiFetch<Detalle>(`/api/recuentos/${id}`),
  });

  const reabrir = useMutation({
    mutationFn: () =>
      apiFetch(`/api/recuentos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ accion: "reabrir" }),
      }),
    onSuccess: () => {
      toast.success("Recuento reabierto: el operario puede volver a editarlo");
      queryClient.invalidateQueries({ queryKey: ["recuento", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <p className="text-muted">Cargando…</p>;
  const r = data.recuento;
  const lineasActivas = r.lineas.filter((l) => l.estado === "ACTIVA");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/oficina/recuentos"
            aria-label="Volver"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{r.ubicacion.codigo}</h1>
            <p className="text-sm text-muted">
              {r.ubicacion.estanteria.estancia.almacen.nombre} ·{" "}
              {r.ubicacion.estanteria.estancia.nombre} · {r.ubicacion.estanteria.codigo}
            </p>
          </div>
        </div>
        {r.estado === "FINALIZADO" && (
          <Button variant="outline" onPress={() => reabrir.mutate()} isDisabled={reabrir.isPending}>
            <RotateCcw className="h-4 w-4" />
            Reabrir recuento
          </Button>
        )}
      </div>

      <Card>
        <Card.Content className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-muted">Operario</p>
            <p className="font-medium">
              {r.operario.nombre} ({r.operario.nbi})
            </p>
          </div>
          <div>
            <p className="text-muted">Estado</p>
            <p>
              {r.estado === "FINALIZADO" ? (
                <Chip size="sm" color="success" variant="soft">
                  Finalizado
                </Chip>
              ) : (
                <Chip size="sm" variant="soft">
                  En curso
                </Chip>
              )}
            </p>
          </div>
          <div>
            <p className="text-muted">Inicio / fin</p>
            <p className="font-medium">
              {formatearFecha(r.iniciadoEn)} → {formatearFecha(r.finalizadoEn)}
            </p>
          </div>
          <div>
            <p className="text-muted">Firma</p>
            <p className="font-medium">
              {r.firmaNombre ? `${r.firmaNombre} · NBI ${r.firmaNbi}` : "—"}
            </p>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Líneas contadas ({lineasActivas.length})</Card.Title>
        </Card.Header>
        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Líneas del recuento">
                <Table.Header>
                  <Table.Column isRowHeader>Foto</Table.Column>
                  <Table.Column>Descripción</Table.Column>
                  <Table.Column>Cantidad</Table.Column>
                  <Table.Column>Unidad</Table.Column>
                  <Table.Column>Incidencia</Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <p className="py-8 text-center text-muted">Sin líneas contadas.</p>
                  )}
                >
                  {lineasActivas.map((l) => (
                    <Table.Row key={l.id}>
                      <Table.Cell>
                        {l.fotoEtiquetaUrl ? (
                          <a href={l.fotoEtiquetaUrl} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={l.fotoEtiquetaUrl}
                              alt="Etiqueta"
                              className="h-12 w-12 rounded-md border object-cover"
                            />
                          </a>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <p className="font-medium">{l.descripcionArticulo || "(sin descripción)"}</p>
                        {l.textoOcr && (
                          <p className="max-w-md truncate text-xs text-muted">OCR: {l.textoOcr}</p>
                        )}
                      </Table.Cell>
                      <Table.Cell className="font-semibold">{formatearCantidad(l.cantidad)}</Table.Cell>
                      <Table.Cell>{l.unidadMedida?.codigo ?? "—"}</Table.Cell>
                      <Table.Cell>
                        {l.incidencia ? (
                          l.incidencia.estado === "ABIERTA" ? (
                            <Chip size="sm" color="warning" variant="soft">
                              <AlertTriangle className="h-3 w-3" /> Abierta
                            </Chip>
                          ) : (
                            <Chip size="sm" color="success" variant="soft">
                              Resuelta
                            </Chip>
                          )
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}
