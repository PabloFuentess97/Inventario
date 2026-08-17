"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button, Chip, Input, Table, Tabs } from "@heroui/react";
import { apiFetch } from "@/lib/cliente-api";
import { formatearFecha } from "@/lib/utils";

interface RecuentoFila {
  id: string;
  estado: "EN_PROGRESO" | "FINALIZADO";
  iniciadoEn: string;
  finalizadoEn: string | null;
  firmaNombre: string | null;
  firmaNbi: string | null;
  operario: { nombre: string; nbi: string };
  ubicacion: {
    codigo: string;
    estanteria: { codigo: string; pasillo: { nombre: string; almacen: { nombre: string } } };
  };
  _count: { lineas: number };
}

export default function PaginaRecuentos() {
  const [estado, setEstado] = useState<string>("TODOS");
  const [buscar, setBuscar] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 25;

  const { data, isLoading } = useQuery({
    queryKey: ["recuentos", estado, buscar, pagina],
    queryFn: () =>
      apiFetch<{ total: number; recuentos: RecuentoFila[] }>(
        `/api/recuentos?pagina=${pagina}&porPagina=${porPagina}` +
          (estado !== "TODOS" ? `&estado=${estado}` : "") +
          (buscar ? `&buscar=${encodeURIComponent(buscar)}` : "")
      ),
    refetchInterval: 10_000,
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / porPagina)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Recuentos</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          selectedKey={estado}
          onSelectionChange={(k) => {
            setEstado(String(k));
            setPagina(1);
          }}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="Filtrar por estado">
              <Tabs.Tab id="TODOS" className="whitespace-nowrap">
                Todos
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="EN_PROGRESO" className="whitespace-nowrap">
                En curso
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="FINALIZADO" className="whitespace-nowrap">
                Finalizados
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            fullWidth
            className="pl-9"
            placeholder="Buscar ubicación u operario…"
            aria-label="Buscar recuentos"
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value);
              setPagina(1);
            }}
          />
        </div>
      </div>

      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label="Listado de recuentos">
            <Table.Header>
              <Table.Column isRowHeader>Ubicación</Table.Column>
              <Table.Column>Estantería / Zona</Table.Column>
              <Table.Column>Operario</Table.Column>
              <Table.Column>Líneas</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Inicio</Table.Column>
              <Table.Column>Fin</Table.Column>
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <p className="py-8 text-center text-muted">
                  {isLoading ? "Cargando…" : "No hay recuentos que coincidan."}
                </p>
              )}
            >
              {(data?.recuentos ?? []).map((r) => (
                <Table.Row key={r.id}>
                  <Table.Cell>
                    <Link
                      href={`/oficina/recuentos/${r.id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {r.ubicacion.codigo}
                    </Link>
                  </Table.Cell>
                  <Table.Cell className="text-muted">
                    {r.ubicacion.estanteria.codigo} · {r.ubicacion.estanteria.pasillo.nombre}
                  </Table.Cell>
                  <Table.Cell>
                    {r.operario.nombre} <span className="text-muted">({r.operario.nbi})</span>
                  </Table.Cell>
                  <Table.Cell>{r._count.lineas}</Table.Cell>
                  <Table.Cell>
                    {r.estado === "EN_PROGRESO" ? (
                      <Chip size="sm" variant="soft">
                        En curso
                      </Chip>
                    ) : (
                      <Chip size="sm" color="success" variant="soft">
                        Finalizado
                      </Chip>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-muted">{formatearFecha(r.iniciadoEn)}</Table.Cell>
                  <Table.Cell className="text-muted">{formatearFecha(r.finalizadoEn)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" isDisabled={pagina <= 1} onPress={() => setPagina(pagina - 1)}>
            Anterior
          </Button>
          <span className="text-muted">
            Página {pagina} de {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            isDisabled={pagina >= totalPaginas}
            onPress={() => setPagina(pagina + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
