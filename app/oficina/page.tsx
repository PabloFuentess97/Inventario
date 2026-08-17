"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, GitMerge, ListChecks, MapPin } from "lucide-react";
import { Card, Chip, Skeleton, Table } from "@heroui/react";
import { apiFetch } from "@/lib/cliente-api";
import { formatearFecha } from "@/lib/utils";

interface Resumen {
  enProgreso: number;
  finalizados: number;
  incidenciasAbiertas: number;
  gruposPendientes: number;
  ubicaciones: number;
  ubicacionesContadas: number;
  activos: {
    id: string;
    iniciadoEn: string;
    operario: { nombre: string; nbi: string };
    ubicacion: { codigo: string; estanteria: { codigo: string; pasillo: { nombre: string } } };
    _count: { lineas: number };
  }[];
}

/** Panel de oficina con actualización en tiempo casi real (polling ligero). */
export default function PaginaPanelOficina() {
  const { data, isLoading } = useQuery({
    queryKey: ["resumen-oficina"],
    queryFn: () => apiFetch<Resumen>("/api/oficina/resumen"),
    refetchInterval: 5_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const tarjetas = [
    {
      titulo: "Recuentos en curso",
      valor: data.enProgreso,
      icono: ListChecks,
      href: "/oficina/recuentos?estado=EN_PROGRESO",
      color: "text-accent",
    },
    {
      titulo: "Ubicaciones contadas",
      valor: `${data.ubicacionesContadas} / ${data.ubicaciones}`,
      icono: MapPin,
      href: "/oficina/recuentos",
      color: "text-success",
    },
    {
      titulo: "Incidencias abiertas",
      valor: data.incidenciasAbiertas,
      icono: AlertTriangle,
      href: "/oficina/incidencias",
      color: "text-warning",
    },
    {
      titulo: "Similitudes pendientes",
      valor: data.gruposPendientes,
      icono: GitMerge,
      href: "/oficina/similitudes",
      color: "text-accent",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">Panel de recuento</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Link key={t.titulo} href={t.href}>
            <Card className="transition-shadow hover:shadow-md">
              <Card.Content className="flex flex-row items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted">{t.titulo}</p>
                  <p className="text-3xl font-bold">{t.valor}</p>
                </div>
                <t.icono className={`h-8 w-8 ${t.color}`} />
              </Card.Content>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Operarios contando ahora</Card.Title>
        </Card.Header>
        <Card.Content>
          {data.activos.length === 0 ? (
            <p className="py-4 text-sm text-muted">
              No hay ningún recuento en curso en este momento.
            </p>
          ) : (
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Recuentos en curso">
                  <Table.Header>
                    <Table.Column isRowHeader>Ubicación</Table.Column>
                    <Table.Column>Zona</Table.Column>
                    <Table.Column>Operario</Table.Column>
                    <Table.Column>Líneas</Table.Column>
                    <Table.Column>Inicio</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.activos.map((r) => (
                      <Table.Row key={r.id}>
                        <Table.Cell className="font-medium">{r.ubicacion.codigo}</Table.Cell>
                        <Table.Cell>{r.ubicacion.estanteria.pasillo.nombre}</Table.Cell>
                        <Table.Cell>
                          {r.operario.nombre}{" "}
                          <span className="text-muted">({r.operario.nbi})</span>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft">
                            {r._count.lineas}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-muted">{formatearFecha(r.iniciadoEn)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
